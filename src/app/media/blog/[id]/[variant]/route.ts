import { readMediaVariant } from "@/lib/blog-media";

/**
 * Immutable media route for imported blog images.
 * Only numeric ids and the exact variant widths the importer generates are
 * accepted, so the handler cannot be used to read arbitrary files.
 */
const ALLOWED_WIDTHS = new Set([480, 960, 1600, 2000]);

export async function GET(_request: Request, context: { params: Promise<{ id: string; variant: string }> }) {
  const { id: rawId, variant: rawVariant } = await context.params;
  const id = Number(rawId);
  const width = Number(String(rawVariant).replace(/\.webp$/i, ""));
  if (!Number.isInteger(id) || id <= 0 || !ALLOWED_WIDTHS.has(width)) {
    return new Response("Not found", { status: 404 });
  }
  const buffer = await readMediaVariant(id, width);
  if (!buffer) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
