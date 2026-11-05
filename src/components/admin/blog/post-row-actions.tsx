"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Copy, ExternalLink, Loader2, RotateCcw, Send, Trash2, Undo2 } from "lucide-react";
import { apiFetch, errorMessage } from "./api";
import type { BlogStatus, PostAction } from "./types";

const buttonClass =
  "grid h-7 w-7 place-items-center rounded-lg border border-transparent text-ink-600/60 transition-colors hover:border-mist-200 hover:bg-mist-50 hover:text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-40";

/**
 * Per-row blog actions. Every mutation goes through the JSON API and then
 * refreshes the server-rendered list; a 401 is handled by `apiFetch`, which
 * redirects to the sign-in screen.
 */
export function PostRowActions({ id, status, slug }: { id: number; status: BlogStatus; slug: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runAction(action: PostAction) {
    setPending(action);
    setError(null);
    try {
      const result = await apiFetch<{ id: number }>(`/api/admin/blog/posts/${id}/actions`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      if (action === "duplicate") {
        router.push(`/admin/blog/${result.id}`);
        return;
      }
      router.refresh();
    } catch (actionFailure) {
      setError(errorMessage(actionFailure));
    } finally {
      setPending(null);
    }
  }

  async function deleteForever() {
    if (!window.confirm("Delete this post permanently? This cannot be undone.")) return;
    setPending("delete");
    setError(null);
    try {
      await apiFetch(`/api/admin/blog/posts/${id}?permanent=1`, { method: "DELETE" });
      router.refresh();
    } catch (deleteFailure) {
      setError(errorMessage(deleteFailure));
    } finally {
      setPending(null);
    }
  }

  const busy = pending !== null;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center justify-end gap-1">
        {status === "published" && (
          <Link href={`/blog/${slug}`} target="_blank" rel="noreferrer" aria-label="View published post" title="View published post" className={buttonClass}>
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        )}
        {status !== "published" && status !== "trashed" && (
          <button type="button" onClick={() => void runAction("publish")} disabled={busy} aria-label="Publish post" title="Publish post" className={buttonClass}>
            {pending === "publish" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </button>
        )}
        {status === "published" && (
          <button type="button" onClick={() => void runAction("unpublish")} disabled={busy} aria-label="Unpublish post" title="Unpublish post" className={buttonClass}>
            {pending === "unpublish" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}
          </button>
        )}
        <button type="button" onClick={() => void runAction("duplicate")} disabled={busy} aria-label="Duplicate post" title="Duplicate post" className={buttonClass}>
          {pending === "duplicate" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
        {status !== "trashed" ? (
          <button type="button" onClick={() => void runAction("trash")} disabled={busy} aria-label="Move post to trash" title="Move post to trash" className={buttonClass}>
            {pending === "trash" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <button type="button" onClick={() => void runAction("restore")} disabled={busy} aria-label="Restore post" title="Restore post" className={buttonClass}>
            {pending === "restore" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
          </button>
        )}
        <button
          type="button"
          onClick={() => void deleteForever()}
          disabled={busy}
          aria-label="Delete post permanently"
          title="Delete post permanently"
          className={`${buttonClass} text-rose-500 hover:bg-rose-50 hover:text-rose-700`}
        >
          {pending === "delete" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        </button>
      </div>
      {error && (
        <p role="alert" className="max-w-[16rem] text-right text-[0.62rem] font-semibold leading-snug text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}
