import { NextResponse } from "next/server";
import { importImageFromUrl } from "@/lib/blog-media";
import { failure, limitAdmin, readJson, requireAdmin, str } from "@/lib/api-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Import a remote image into managed storage.
 * Heavy on purpose: downloads the file server-side, so it is rate limited to a
 * small number of operations per minute.
 */
export async function POST(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const limited = await limitAdmin("media-import", 20);
  if (limited) return limited;
  try {
    const body = await readJson(request);
    const url = str(body.url, 2000);
    if (!url) throw new Error("Paste an image URL first.");
    const media = await importImageFromUrl({
      url,
      alt: str(body.alt, 300),
      caption: str(body.caption, 400),
      license: str(body.license, 200),
      attribution: str(body.attribution, 300),
      external: body.external === true,
    });
    return NextResponse.json({ ok: true, mode: "mode" in media ? "external" : "imported", media });
  } catch (error) {
    return failure(error);
  }
}
