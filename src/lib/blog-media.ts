import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { isIP } from "node:net";
import path from "node:path";
import sharp from "sharp";
import type { Metadata, Sharp } from "sharp";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { blogMedia } from "@/db/schema";
import { sqlitePath } from "./sqlite";

/**
 * URL-based blog image import.
 *
 * The owner supplies a URL; the server downloads it itself, so this is an SSRF
 * surface and is treated as hostile input:
 *   - only http/https, no credentials, no non-standard ports
 *   - hostname is resolved and every address must be public (no loopback,
 *     private ranges, link-local, CGNAT or cloud metadata endpoints)
 *   - redirects are followed manually (max 3) and re-validated at each hop
 *   - 12s timeout, 8 MB body cap, content-type allow-list, no SVG
 *   - decoded with sharp and re-encoded to WebP variants, which also strips
 *     EXIF/metadata and neutralises polyglot files
 * Binaries are stored on disk under the data directory (never in SQLite) and
 * served through an immutable cache route. Identical bytes are de-duplicated by
 * SHA-256 so the same image is never downloaded twice.
 */

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 12_000;
const MIN_DIMENSION = 200;
const MAX_DIMENSION = 8_000;
const VARIANT_WIDTHS = [480, 960, 1600] as const;
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp", "avif"]);
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

/** CDNs we are willing to reference directly when the owner insists on a hotlink. */
export const TRUSTED_EXTERNAL_HOSTS = new Set([
  "images.pexels.com",
  "images.unsplash.com",
  "res.cloudinary.com",
  "cdn.pixabay.com",
]);

function dataDirectory(): string {
  return path.join(path.dirname(sqlitePath()), "blog-media");
}

export function mediaDirectory(id: number): string {
  return path.join(dataDirectory(), String(id));
}

export function mediaPath(id: number, width: number): string {
  return `/media/blog/${id}/${width}.webp`;
}

export function mediaSrcSet(id: number, widths: number[]): string {
  return widths.map((width) => `${mediaPath(id, width)} ${width}w`).join(", ");
}

export interface ImportedMedia {
  id: number;
  width: number;
  height: number;
  format: "webp";
  src: string;
  srcSet: string;
  widths: number[];
  alt: string | null;
  caption: string | null;
  sourceUrl: string;
  license: string | null;
  attribution: string | null;
  deduplicated: boolean;
}

export interface ExternalMedia {
  mode: "external";
  url: string;
  warning: string;
  width: number | null;
  height: number | null;
}

/* ---------------------------------------------------------------- SSRF guard */

function isPrivateIPv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && (b === 0 || b === 168)) return true;
  if (a === 192 && b === 0 && parts[2] === 2) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 198 && b === 51 && parts[2] === 100) return true;
  if (a === 203 && b === 0 && parts[2] === 113) return true;
  if (a >= 224) return true;
  return false;
}

function isPrivateIPv6(address: string): boolean {
  const value = address.toLowerCase();
  if (value === "::" || value === "::1") return true;
  if (value.startsWith("fc") || value.startsWith("fd")) return true;
  if (/^fe[89ab]/.test(value)) return true;
  if (value.startsWith("64:ff9b:")) return true;
  if (value.startsWith("2001:db8")) return true;
  const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
  return false;
}

function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (!host) return true;
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".home.arpa")) return true;
  if (host === "metadata.google.internal" || host === "metadata.google") return true;
  if (host === "instance-data" || host.endsWith(".internal")) return true;
  return false;
}

async function assertSafeUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("That does not look like a valid image URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Only http and https image URLs are supported.");
  if (url.username || url.password) throw new Error("Image URLs with embedded credentials are not allowed.");
  if (url.port && url.port !== "80" && url.port !== "443") throw new Error("Image URLs may only use the standard web ports.");
  if (isBlockedHostname(url.hostname)) throw new Error("That host is not allowed for image import.");

  const literal = isIP(url.hostname);
  if (literal === 4) {
    if (isPrivateIPv4(url.hostname)) throw new Error("Private or reserved IP addresses are not allowed.");
    return url;
  }
  if (literal === 6) {
    if (isPrivateIPv6(url.hostname)) throw new Error("Private or reserved IP addresses are not allowed.");
    return url;
  }

  let addresses: { address: string; family: number }[];
  try {
    addresses = await lookup(url.hostname, { all: true, verbatim: true });
  } catch {
    throw new Error("That image host could not be resolved.");
  }
  if (!addresses.length) throw new Error("That image host could not be resolved.");
  for (const entry of addresses) {
    const blocked = entry.family === 6 ? isPrivateIPv6(entry.address) : isPrivateIPv4(entry.address);
    if (blocked) throw new Error("That image host resolves to a private or reserved address.");
  }
  return url;
}

/* --------------------------------------------------------------- download */

async function downloadImage(rawUrl: string): Promise<{ buffer: Buffer; contentType: string; finalUrl: string }> {
  let current = await assertSafeUrl(rawUrl);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const response = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "user-agent": "KnightMedicalBillingBot/1.0 (+https://www.knightmedicalbilling.com)",
        accept: "image/jpeg,image/png,image/webp,image/avif",
      },
    }).catch(() => {
      throw new Error("The image could not be downloaded (network error or timeout).");
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("The image host returned a redirect without a destination.");
      current = await assertSafeUrl(new URL(location, current).toString());
      continue;
    }
    if (!response.ok) throw new Error(`The image host returned HTTP ${response.status}.`);

    const contentType = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!ALLOWED_MIME.has(contentType)) throw new Error("The URL is not a supported image (JPEG, PNG, WebP or AVIF only).");
    const declared = Number(response.headers.get("content-length") ?? "0");
    if (declared > MAX_BYTES) throw new Error("That image is larger than the 8 MB import limit.");

    const chunks: Uint8Array[] = [];
    let total = 0;
    const reader = response.body?.getReader();
    if (!reader) throw new Error("The image host returned an empty response.");
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) throw new Error("That image is larger than the 8 MB import limit.");
      chunks.push(value);
    }
    const buffer = Buffer.concat(chunks);
    if (!buffer.length) throw new Error("The image host returned an empty file.");
    return { buffer, contentType, finalUrl: current.toString() };
  }
  throw new Error("The image URL redirected too many times.");
}

/* ------------------------------------------------------------------ import */

export async function importImageFromUrl(input: {
  url: string;
  alt?: string | null;
  caption?: string | null;
  license?: string | null;
  attribution?: string | null;
  external?: boolean;
}): Promise<ImportedMedia | ExternalMedia> {
  const url = input.url.trim();
  if (!url) throw new Error("Paste an image URL first.");

  if (input.external) {
    const parsed = await assertSafeUrl(url);
    if (!TRUSTED_EXTERNAL_HOSTS.has(parsed.hostname.toLowerCase())) {
      throw new Error(
        "Direct external mode is limited to trusted image CDNs. Import the image instead so it is stored on this site.",
      );
    }
    return {
      mode: "external",
      url: parsed.toString(),
      warning: "External images are hotlinked: the provider can remove them or block embedding at any time. Import the image to avoid broken articles.",
      width: null,
      height: null,
    };
  }

  const { buffer, finalUrl } = await downloadImage(url);
  const sha256 = createHash("sha256").update(buffer).digest("hex");

  const existing = await db.select().from(blogMedia).where(eq(blogMedia.sha256, sha256)).limit(1);
  if (existing.length) {
    const row = existing[0];
    const widths = VARIANT_WIDTHS.filter((width) => width <= row.width);
    const finalWidths = widths.length ? widths : [row.width];
    return {
      id: row.id,
      width: row.width,
      height: row.height,
      format: "webp",
      src: mediaPath(row.id, finalWidths[finalWidths.length - 1]),
      srcSet: mediaSrcSet(row.id, finalWidths),
      widths: [...finalWidths],
      alt: input.alt ?? row.alt,
      caption: input.caption ?? row.caption,
      sourceUrl: row.sourceUrl ?? finalUrl,
      license: input.license ?? row.license,
      attribution: input.attribution ?? row.attribution,
      deduplicated: true,
    };
  }

  let pipeline: Sharp;
  let metadata: Metadata;
  try {
    pipeline = sharp(buffer, { limitInputPixels: MAX_DIMENSION * MAX_DIMENSION, failOn: "error" });
    metadata = await pipeline.metadata();
  } catch {
    throw new Error("That file is not a readable image.");
  }
  const format = metadata.format ?? "";
  if (!ALLOWED_FORMATS.has(format)) throw new Error("That image format is not supported (JPEG, PNG, WebP or AVIF only).");
  const rotated = metadata.orientation && metadata.orientation > 1;
  const width = (rotated ? metadata.height : metadata.width) ?? 0;
  const height = (rotated ? metadata.width : metadata.height) ?? 0;
  if (width < MIN_DIMENSION || height < MIN_DIMENSION) {
    throw new Error(`That image is too small (minimum ${MIN_DIMENSION}×${MIN_DIMENSION}px).`);
  }
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) throw new Error("That image is too large to process.");

  const effectiveWidth = Math.min(width, 2000);
  const widths: number[] = VARIANT_WIDTHS.filter((candidate) => candidate <= effectiveWidth);
  if (!widths.length) widths.push(effectiveWidth);

  const [row] = await db
    .insert(blogMedia)
    .values({
      sourceUrl: finalUrl,
      storageKey: sha256,
      mime: "image/webp",
      width,
      height,
      sha256,
      alt: input.alt?.slice(0, 300) ?? null,
      caption: input.caption?.slice(0, 400) ?? null,
      license: input.license?.slice(0, 200) ?? null,
      attribution: input.attribution?.slice(0, 300) ?? null,
    })
    .returning({ id: blogMedia.id });

  const directory = mediaDirectory(row.id);
  try {
    await mkdir(directory, { recursive: true });
    let savedBytes = 0;
    for (const variantWidth of widths) {
      const target = path.join(directory, `${variantWidth}.webp`);
      const info = await sharp(buffer, { limitInputPixels: MAX_DIMENSION * MAX_DIMENSION })
        .rotate()
        .resize({ width: variantWidth, withoutEnlargement: true })
        .webp({ quality: 82, effort: 4 })
        .toFile(target);
      savedBytes = Math.max(savedBytes, info.size);
    }
    await db.update(blogMedia).set({ storageKey: String(row.id), sizeBytes: savedBytes }).where(eq(blogMedia.id, row.id));
  } catch (error) {
    await db.delete(blogMedia).where(eq(blogMedia.id, row.id)).catch(() => undefined);
    await unlink(directory).catch(() => undefined);
    throw new Error(error instanceof Error ? `The image could not be processed: ${error.message}` : "The image could not be processed.");
  }

  const finalWidth = widths[widths.length - 1];
  return {
    id: row.id,
    width,
    height,
    format: "webp",
    src: mediaPath(row.id, finalWidth),
    srcSet: mediaSrcSet(row.id, widths),
    widths: [...widths],
    alt: input.alt ?? null,
    caption: input.caption ?? null,
    sourceUrl: finalUrl,
    license: input.license ?? null,
    attribution: input.attribution ?? null,
    deduplicated: false,
  };
}

/** Look up a stored media row (used by the editor when reopening a post). */
export async function getMedia(id: number) {
  const rows = await db.select().from(blogMedia).where(and(eq(blogMedia.id, id))).limit(1);
  return rows[0] ?? null;
}

/** Read a stored variant from disk (media route). */
export async function readMediaVariant(id: number, width: number): Promise<Buffer | null> {
  try {
    return await readFile(path.join(mediaDirectory(id), `${width}.webp`));
  } catch {
    return null;
  }
}

/** Write a file atomically (reserved for future variants). */
export async function storeVariant(id: number, width: number, data: Buffer): Promise<string> {
  const directory = mediaDirectory(id);
  await mkdir(directory, { recursive: true });
  const target = path.join(directory, `${width}.webp`);
  const temporary = `${target}.${randomUUID()}.tmp`;
  await writeFile(temporary, data);
  return temporary;
}
