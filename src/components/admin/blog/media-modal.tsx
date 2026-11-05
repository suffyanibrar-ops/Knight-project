"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AlertTriangle, ImagePlus, Loader2, Upload, X } from "lucide-react";
import { ApiError, apiFetch } from "./api";
import type { ExternalMedia, ImportedMedia, MediaResponse, ResolvedMedia } from "./types";

const inputClass =
  "mt-1.5 w-full rounded-xl border border-mist-200 bg-surface px-3.5 py-2.5 text-[0.82rem] text-ink-900 outline-none transition-colors placeholder:text-ink-600/40 focus:border-brand-400 focus:ring-2 focus:ring-brand-100";
const labelClass = "text-[0.6rem] font-extrabold uppercase tracking-[0.12em] text-ink-600/70";

export function MediaImportModal({
  onClose,
  onUseFeatured,
  onInsert,
}: {
  onClose: () => void;
  onUseFeatured: (media: ResolvedMedia) => void;
  onInsert: (media: ResolvedMedia) => void;
}) {
  const titleId = useId();
  const urlInputRef = useRef<HTMLInputElement | null>(null);

  const [url, setUrl] = useState("");
  const [alt, setAlt] = useState("");
  const [caption, setCaption] = useState("");
  const [license, setLicense] = useState("");
  const [attribution, setAttribution] = useState("");
  const [external, setExternal] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResolvedMedia | null>(null);
  const [previewBroken, setPreviewBroken] = useState(false);

  // Escape closes the dialog.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const previewSrc = result?.src ?? url.trim();

  async function importMedia() {
    const target = url.trim();
    if (!target) {
      setError("Paste an image URL first.");
      return;
    }
    setPending(true);
    setError(null);
    setResult(null);
    setPreviewBroken(false);
    try {
      const data = await apiFetch<MediaResponse>("/api/admin/blog/media", {
        method: "POST",
        body: JSON.stringify({
          url: target,
          alt: alt.trim() || null,
          caption: caption.trim() || null,
          license: license.trim() || null,
          attribution: attribution.trim() || null,
          external,
        }),
      });
      if (data.mode === "external") {
        const media: ExternalMedia = data.media;
        setResult({
          mode: "external",
          src: media.url,
          mediaId: null,
          width: media.width,
          height: media.height,
          alt: alt.trim(),
          caption: caption.trim(),
          license: license.trim() || null,
          attribution: attribution.trim() || null,
          warning: media.warning,
        });
      } else {
        const media: ImportedMedia = data.media;
        setResult({
          mode: "imported",
          src: media.src,
          mediaId: media.id,
          width: media.width,
          height: media.height,
          alt: media.alt ?? alt.trim(),
          caption: media.caption ?? caption.trim(),
          license: media.license ?? (license.trim() || null),
          attribution: media.attribution ?? (attribution.trim() || null),
          warning: null,
        });
      }
    } catch (importError) {
      setError(importError instanceof ApiError ? importError.message : "The image could not be imported.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-night/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-mist-200 bg-surface shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-mist-100 px-5 py-4">
          <h2 id={titleId} className="flex items-center gap-2 text-[0.95rem] font-extrabold tracking-tight text-ink-950">
            <ImagePlus className="h-4 w-4 text-brand-600" /> Add an image
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close image dialog"
            className="grid h-8 w-8 place-items-center rounded-full text-ink-600/60 transition-colors hover:bg-mist-100 hover:text-ink-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_13rem]">
            <div className="space-y-3">
              <label className="block">
                <span className={labelClass}>Image URL</span>
                <input
                  ref={urlInputRef}
                  type="url"
                  value={url}
                  onChange={(event) => {
                    setUrl(event.target.value);
                    setPreviewBroken(false);
                  }}
                  placeholder="https://images.pexels.com/photos/…/photo.jpg"
                  className={inputClass}
                  spellCheck={false}
                  autoFocus
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className={labelClass}>Alt text</span>
                  <input type="text" value={alt} onChange={(event) => setAlt(event.target.value)} placeholder="Describe the image" maxLength={300} className={inputClass} />
                </label>
                <label className="block">
                  <span className={labelClass}>Caption</span>
                  <input type="text" value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Optional visible caption" maxLength={400} className={inputClass} />
                </label>
                <label className="block">
                  <span className={labelClass}>License</span>
                  <input type="text" value={license} onChange={(event) => setLicense(event.target.value)} placeholder="e.g. Pexels License" maxLength={200} className={inputClass} />
                </label>
                <label className="block">
                  <span className={labelClass}>Attribution</span>
                  <input type="text" value={attribution} onChange={(event) => setAttribution(event.target.value)} placeholder="Photographer / source" maxLength={300} className={inputClass} />
                </label>
              </div>
              <label className="flex items-start gap-2 rounded-xl border border-mist-200 bg-mist-50/60 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={external}
                  onChange={(event) => setExternal(event.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 rounded border-mist-300 accent-brand-600"
                />
                <span className="text-[0.72rem] leading-relaxed text-ink-700">
                  Hotlink from a trusted CDN instead of importing. Importing is recommended: the file is copied to this site, resized and never disappears.
                </span>
              </label>
            </div>

            <div className="flex flex-col gap-2">
              <span className={labelClass}>Preview</span>
              <div className="grid min-h-[9rem] place-items-center overflow-hidden rounded-2xl border border-dashed border-mist-300 bg-mist-50 p-2">
                {previewSrc && !previewBroken ? (
                  // eslint-disable-next-line @next/next/no-img-element -- arbitrary remote previews are not on the Next image allow-list
                  <img
                    src={previewSrc}
                    alt={alt || "Image preview"}
                    className="max-h-48 w-full rounded-xl object-contain"
                    onError={() => setPreviewBroken(true)}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <p className="px-3 text-center text-[0.7rem] text-ink-600/70">
                    {previewBroken ? "That URL could not be previewed. You can still try importing it." : "Paste a URL to preview it here."}
                  </p>
                )}
              </div>
              {result && (
                <p className="text-[0.68rem] font-semibold leading-relaxed text-ink-600/80">
                  {result.width && result.height ? `${result.width} × ${result.height} px` : "Dimensions unknown"}
                  {result.mode === "imported" ? " · WebP (stored on this site)" : " · External hotlink"}
                </p>
              )}
            </div>
          </div>

          {error && (
            <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[0.76rem] font-semibold text-rose-700">
              {error}
            </p>
          )}

          {result?.warning && (
            <div role="alert" className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-[0.76rem] font-semibold leading-relaxed text-amber-900">{result.warning}</p>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void importMedia()}
              disabled={pending || !url.trim()}
              className="inline-flex items-center gap-1.5 rounded-full bg-night-soft px-4 py-2.5 text-[0.72rem] font-bold text-white transition-colors hover:bg-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {pending ? "Importing…" : "Import image"}
            </button>
            <button
              type="button"
              onClick={() => result && onUseFeatured(result)}
              disabled={!result}
              className="inline-flex items-center gap-1.5 rounded-full border border-mist-200 bg-surface px-4 py-2.5 text-[0.72rem] font-bold text-ink-800 transition-colors hover:border-brand-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Use as featured image
            </button>
            <button
              type="button"
              onClick={() => result && onInsert(result)}
              disabled={!result}
              className="inline-flex items-center gap-1.5 rounded-full border border-mist-200 bg-surface px-4 py-2.5 text-[0.72rem] font-bold text-ink-800 transition-colors hover:border-brand-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Insert into article
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
