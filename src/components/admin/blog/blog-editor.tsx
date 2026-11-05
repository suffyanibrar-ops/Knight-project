"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ClipboardEvent, type ReactNode } from "react";
import {
  AlignLeft,
  Bold,
  Clock,
  ExternalLink,
  Eye,
  Heading2,
  Heading3,
  Heading4,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Minus,
  Quote,
  Redo2,
  RotateCcw,
  Save,
  Send,
  Strikethrough,
  Table2,
  Trash2,
  Underline,
  Undo2,
} from "lucide-react";
import { formatDate } from "@/components/admin/ui";
import { apiFetch, errorMessage } from "./api";
import { MediaImportModal } from "./media-modal";
import { BlogStatusBadge } from "./status-badge";
import type { BlogCategoryWithCount, BlogPostFull, BlogStatus, BlogTagWithCount, PostAction, ResolvedMedia } from "./types";

const inputClass =
  "mt-1.5 w-full rounded-xl border border-mist-200 bg-surface px-3.5 py-2.5 text-[0.82rem] text-ink-900 outline-none transition-colors placeholder:text-ink-600/40 focus:border-brand-400 focus:ring-2 focus:ring-brand-100";
const labelClass = "text-[0.6rem] font-extrabold uppercase tracking-[0.12em] text-ink-600/70";
const sectionTitleClass = "text-[0.78rem] font-extrabold uppercase tracking-[0.1em] text-ink-900";

type EditorDraft = {
  title: string;
  slug: string;
  excerpt: string;
  featuredImage: string;
  featuredImageAlt: string;
  featuredImageWidth: string;
  featuredImageHeight: string;
  featuredMediaId: number | null;
  author: string;
  categoryId: string;
  tagIds: number[];
  status: BlogStatus;
  scheduledFor: string;
  seoTitle: string;
  seoDescription: string;
  canonicalUrl: string;
  socialImage: string;
  sourceNotes: string;
};

const EMPTY_DRAFT: EditorDraft = {
  title: "",
  slug: "",
  excerpt: "",
  featuredImage: "",
  featuredImageAlt: "",
  featuredImageWidth: "",
  featuredImageHeight: "",
  featuredMediaId: null,
  author: "Knight Medical Billing",
  categoryId: "",
  tagIds: [],
  status: "draft",
  scheduledFor: "",
  seoTitle: "",
  seoDescription: "",
  canonicalUrl: "",
  socialImage: "",
  sourceNotes: "",
};

const ACTION_STATUS: Record<PostAction, BlogStatus | null> = {
  publish: "published",
  unpublish: "unpublished",
  schedule: "scheduled",
  trash: "trashed",
  restore: "draft",
  duplicate: null,
};

function draftFromPost(post: BlogPostFull): EditorDraft {
  return {
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt ?? "",
    featuredImage: post.featuredImage ?? "",
    featuredImageAlt: post.featuredImageAlt ?? "",
    featuredImageWidth: post.featuredImageWidth ? String(post.featuredImageWidth) : "",
    featuredImageHeight: post.featuredImageHeight ? String(post.featuredImageHeight) : "",
    featuredMediaId: post.media?.id ?? null,
    author: post.author,
    categoryId: post.category ? String(post.category.id) : "",
    tagIds: post.tags.map((tag) => tag.id),
    status: post.status,
    scheduledFor: toDatetimeLocal(post.scheduledFor),
    seoTitle: post.seoTitle ?? "",
    seoDescription: post.seoDescription ?? "",
    canonicalUrl: post.canonicalUrl ?? "",
    socialImage: post.socialImage ?? "",
    sourceNotes: post.sourceNotes ?? "",
  };
}

function slugifyText(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 90)
    .replace(/-+$/g, "");
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function isoFromLocal(value: string): string | null {
  if (!value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function timeLabel(date: Date): string {
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/** The page template owns the H1; nothing in the body may create a second one. */
function demoteHeadings(root: HTMLElement) {
  root.querySelectorAll("h1").forEach((heading) => {
    const replacement = document.createElement("h2");
    replacement.innerHTML = heading.innerHTML;
    heading.replaceWith(replacement);
  });
}

/** Remove paste-time hazards before the HTML reaches the (also sanitising) server. */
function cleanPastedHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script, style, link, meta, object, embed, iframe, form, input, button, textarea, select").forEach((node) => node.remove());
  doc.querySelectorAll("h1").forEach((heading) => {
    const replacement = doc.createElement("h2");
    replacement.innerHTML = heading.innerHTML;
    heading.replaceWith(replacement);
  });
  doc.querySelectorAll("*").forEach((element) => {
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      const unsafeHref = (name === "href" || name === "src") && /^(javascript|vbscript|data):/i.test(value);
      if (name.startsWith("on") || name === "style" || unsafeHref) element.removeAttribute(attribute.name);
    }
  });
  return doc.body.innerHTML;
}

function buildPayload(draft: EditorDraft, contentHtml: string) {
  return {
    title: draft.title.trim(),
    slug: draft.slug.trim() || undefined,
    excerpt: draft.excerpt.trim(),
    contentHtml,
    featuredImage: draft.featuredImage.trim() || null,
    featuredImageAlt: draft.featuredImageAlt.trim() || null,
    featuredImageWidth: draft.featuredImageWidth ? Number(draft.featuredImageWidth) : null,
    featuredImageHeight: draft.featuredImageHeight ? Number(draft.featuredImageHeight) : null,
    featuredMediaId: draft.featuredMediaId,
    author: draft.author.trim(),
    categoryId: draft.categoryId ? Number(draft.categoryId) : null,
    tagIds: draft.tagIds,
    status: draft.status,
    scheduledFor: isoFromLocal(draft.scheduledFor),
    seoTitle: draft.seoTitle.trim() || null,
    seoDescription: draft.seoDescription.trim() || null,
    canonicalUrl: draft.canonicalUrl.trim() || null,
    socialImage: draft.socialImage.trim() || null,
    sourceNotes: draft.sourceNotes.trim() || null,
  };
}

export function BlogEditor({ postId }: { postId?: number }) {
  const router = useRouter();

  const [draft, setDraft] = useState<EditorDraft>(EMPTY_DRAFT);
  const draftRef = useRef<EditorDraft>(EMPTY_DRAFT);
  const [id, setId] = useState<number | null>(postId ?? null);
  const idRef = useRef<number | null>(postId ?? null);
  const [loaded, setLoaded] = useState(postId === undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [categories, setCategories] = useState<BlogCategoryWithCount[]>([]);
  const [tags, setTags] = useState<BlogTagWithCount[]>([]);
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  const changeRef = useRef(0);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const inFlightRef = useRef<Promise<number | null> | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [tab, setTab] = useState<"content" | "seo">("content");
  const [mediaOpen, setMediaOpen] = useState(false);
  const [contentKey, setContentKey] = useState(0);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const contentHtmlRef = useRef("");
  const slugTouchedRef = useRef(false);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  /* ------------------------------------------------------------- loading */

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [categoryData, tagData] = await Promise.all([
          apiFetch<{ categories: BlogCategoryWithCount[] }>("/api/admin/blog/categories"),
          apiFetch<{ tags: BlogTagWithCount[] }>("/api/admin/blog/tags"),
        ]);
        if (cancelled) return;
        setCategories(categoryData.categories);
        setTags(tagData.tags);

        if (postId !== undefined) {
          const { post } = await apiFetch<{ post: BlogPostFull }>(`/api/admin/blog/posts/${postId}`);
          if (cancelled) return;
          const nextDraft = draftFromPost(post);
          draftRef.current = nextDraft;
          contentHtmlRef.current = post.contentHtml;
          // Editing an existing post must not silently rewrite its slug.
          slugTouchedRef.current = true;
          setDraft(nextDraft);
          setLastSavedAt(post.updatedAt ? timeLabel(new Date(post.updatedAt)) : null);
          setUpdatedAt(post.updatedAt ?? null);
          setContentKey((key) => key + 1);
        }
        setLoaded(true);
      } catch (loadFailure) {
        if (cancelled) return;
        setLoadError(errorMessage(loadFailure));
        setLoaded(true);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [postId]);

  // Write the loaded HTML into the uncontrolled contentEditable exactly once per
  // loaded revision, so typing never fights React over the caret position.
  useEffect(() => {
    const element = contentRef.current;
    if (element) element.innerHTML = contentHtmlRef.current;
  }, [contentKey, loaded]);

  /* ---------------------------------------------------------- change state */

  const markDirty = useCallback(() => {
    changeRef.current += 1;
    dirtyRef.current = true;
    setDirty(true);
    setNotice(null);
  }, []);

  function updateDraft<K extends keyof EditorDraft>(key: K, value: EditorDraft[K]) {
    setDraft((previous) => ({ ...previous, [key]: value }));
    markDirty();
  }

  function handleTitleChange(value: string) {
    setDraft((previous) => ({
      ...previous,
      title: value,
      slug: slugTouchedRef.current ? previous.slug : slugifyText(value),
    }));
    markDirty();
  }

  function handleSlugChange(value: string) {
    slugTouchedRef.current = true;
    updateDraft("slug", value);
  }

  function regenerateSlug() {
    slugTouchedRef.current = false;
    setDraft((previous) => ({ ...previous, slug: slugifyText(previous.title) }));
    markDirty();
  }

  /* ---------------------------------------------------------------- save */

  const save = useCallback(
    (options?: { status?: BlogStatus; navigate?: boolean }): Promise<number | null> => {
      // Coalesce concurrent saves (autosave + toolbar + status actions) onto the
      // same request so a late PATCH can never overwrite a newer status change.
      if (inFlightRef.current) return inFlightRef.current;

      const current: EditorDraft = { ...draftRef.current, status: options?.status ?? draftRef.current.status };
      if (!current.title.trim()) {
        setError("Add a title before saving.");
        return Promise.resolve(null);
      }

      const version = changeRef.current;
      savingRef.current = true;
      setSaving(true);
      setError(null);

      const task = (async (): Promise<number | null> => {
        try {
          const payload = buildPayload(current, contentHtmlRef.current);
          const existingId = idRef.current;

          if (!existingId) {
            const created = await apiFetch<{ id: number }>("/api/admin/blog/posts", { method: "POST", body: JSON.stringify(payload) });
            idRef.current = created.id;
            setId(created.id);
            draftRef.current = current;
            setDraft(current);
            if (changeRef.current === version) {
              dirtyRef.current = false;
              setDirty(false);
            }
            setLastSavedAt(timeLabel(new Date()));
            setUpdatedAt(new Date().toISOString());
            setNotice("Post created.");
            if (options?.navigate !== false) router.replace(`/admin/blog/${created.id}`);
            return created.id;
          }

          await apiFetch<{ id: number }>(`/api/admin/blog/posts/${existingId}`, { method: "PATCH", body: JSON.stringify(payload) });
          if (changeRef.current === version) {
            draftRef.current = current;
            setDraft(current);
            dirtyRef.current = false;
            setDirty(false);
          }
          setLastSavedAt(timeLabel(new Date()));
          setUpdatedAt(new Date().toISOString());
          if (options?.status) setNotice(options.status === "draft" ? "Saved as draft." : "Saved.");
          return existingId;
        } catch (saveFailure) {
          setError(errorMessage(saveFailure));
          return null;
        }
      })();

      inFlightRef.current = task;
      void task.finally(() => {
        if (inFlightRef.current === task) inFlightRef.current = null;
        savingRef.current = false;
        setSaving(false);
      });
      return task;
    },
    [router],
  );

  // Autosave every 15 seconds while there are unsaved changes.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (dirtyRef.current && !savingRef.current) void save();
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [save]);

  // Ctrl/Cmd+S saves immediately.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [save]);

  // Guard against leaving the page with unsaved changes.
  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  /* ---------------------------------------------------------------- rich text */

  const syncContent = useCallback(() => {
    const element = contentRef.current;
    if (!element) return;
    demoteHeadings(element);
    contentHtmlRef.current = element.innerHTML;
    markDirty();
  }, [markDirty]);

  const runCommand = useCallback(
    (command: string, value?: string) => {
      const element = contentRef.current;
      if (!element) return;
      element.focus();
      document.execCommand(command, false, value);
      syncContent();
    },
    [syncContent],
  );

  const insertHtml = useCallback(
    (html: string) => {
      const element = contentRef.current;
      if (!element) return;
      element.focus();
      document.execCommand("insertHTML", false, html);
      syncContent();
    },
    [syncContent],
  );

  function handleContentInput() {
    syncContent();
  }

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    const html = event.clipboardData.getData("text/html");
    const text = event.clipboardData.getData("text/plain");
    event.preventDefault();
    if (html) insertHtml(cleanPastedHtml(html));
    else if (text) insertHtml(escapeHtml(text).replace(/\r?\n/g, "<br />"));
  }

  function addLink() {
    const value = window.prompt("Link URL (https://, mailto:, tel: or a site path)", "https://");
    if (!value) return;
    const url = value.trim();
    if (!url) return;
    if (!/^(https?:\/\/|mailto:|tel:|\/)/i.test(url)) {
      setError("Links must start with https://, mailto:, tel: or /.");
      return;
    }
    runCommand("createLink", url);
  }

  function insertTable() {
    const cells = (count: number, tag: "th" | "td") => Array.from({ length: count }, () => `<${tag}><br /></${tag}>`).join("");
    const head = `<thead><tr>${cells(3, "th")}</tr></thead>`;
    const body = Array.from({ length: 2 }, () => `<tr>${cells(3, "td")}</tr>`).join("");
    insertHtml(`<table>${head}<tbody>${body}</tbody></table><p><br /></p>`);
  }

  /* ---------------------------------------------------------- media */

  const useFeaturedMedia = useCallback(
    (media: ResolvedMedia) => {
      const next: EditorDraft = {
        ...draftRef.current,
        featuredImage: media.src,
        featuredImageAlt: media.alt,
        featuredImageWidth: media.width ? String(media.width) : "",
        featuredImageHeight: media.height ? String(media.height) : "",
        featuredMediaId: media.mediaId,
      };
      draftRef.current = next;
      setDraft(next);
      markDirty();
      setMediaOpen(false);
    },
    [markDirty],
  );

  const insertMedia = useCallback(
    (media: ResolvedMedia) => {
      const attributes = [`src="${escapeHtml(media.src)}"`, `alt="${escapeHtml(media.alt)}"`, 'loading="lazy"', 'decoding="async"'];
      if (media.width) attributes.push(`width="${media.width}"`);
      if (media.height) attributes.push(`height="${media.height}"`);
      const caption = media.caption.trim();
      const figure = `<figure><img ${attributes.join(" ")} />${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ""}</figure><p><br /></p>`;
      insertHtml(figure);
      setMediaOpen(false);
    },
    [insertHtml],
  );

  function removeFeaturedImage() {
    const next: EditorDraft = { ...draftRef.current, featuredImage: "", featuredImageAlt: "", featuredImageWidth: "", featuredImageHeight: "", featuredMediaId: null };
    draftRef.current = next;
    setDraft(next);
    markDirty();
  }

  /* ---------------------------------------------------------- status actions */

  const runAction = useCallback(
    async (action: PostAction, scheduledForIso?: string) => {
      setError(null);
      setNotice(null);
      const wasNew = idRef.current === null;
      const ensuredId = idRef.current ?? (await save({ navigate: false }));
      if (!ensuredId) return;
      setActionPending(action);
      try {
        await apiFetch(`/api/admin/blog/posts/${ensuredId}/actions`, {
          method: "POST",
          body: JSON.stringify(scheduledForIso ? { action, scheduledFor: scheduledForIso } : { action }),
        });
        if (action === "duplicate") {
          router.push("/admin/blog");
          router.refresh();
          return;
        }
        const nextStatus = ACTION_STATUS[action];
        if (nextStatus) {
          const next: EditorDraft = { ...draftRef.current, status: nextStatus, ...(action === "schedule" ? {} : { scheduledFor: "" }) };
          draftRef.current = next;
          setDraft(next);
        }
        setUpdatedAt(new Date().toISOString());
        if (wasNew) {
          router.replace(`/admin/blog/${ensuredId}`);
          return;
        }
        setNotice(
          action === "publish"
            ? "Published."
            : action === "unpublish"
              ? "Unpublished."
              : action === "schedule"
                ? "Scheduled."
                : action === "trash"
                  ? "Moved to trash."
                  : "Restored as a draft.",
        );
      } catch (actionFailure) {
        setError(errorMessage(actionFailure));
      } finally {
        setActionPending(null);
      }
    },
    [router, save],
  );

  const schedulePost = useCallback(() => {
    const iso = isoFromLocal(draftRef.current.scheduledFor);
    if (!iso) {
      setError("Choose a date and time before scheduling.");
      return;
    }
    void runAction("schedule", iso);
  }, [runAction]);

  const deleteForever = useCallback(async () => {
    const target = idRef.current;
    if (!target) return;
    if (!window.confirm("Delete this post permanently? This cannot be undone.")) return;
    setActionPending("delete");
    setError(null);
    try {
      await apiFetch(`/api/admin/blog/posts/${target}?permanent=1`, { method: "DELETE" });
      router.replace("/admin/blog");
      router.refresh();
    } catch (deleteFailure) {
      setError(errorMessage(deleteFailure));
    } finally {
      setActionPending(null);
    }
  }, [router]);

  function moveToTrash() {
    if (!window.confirm("Move this post to the trash? You can restore it later.")) return;
    void runAction("trash");
  }

  /* ---------------------------------------------------------------- render */

  if (!loaded) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-mist-200 bg-surface p-10 text-[0.82rem] font-semibold text-ink-600/80">
        <Loader2 className="h-4 w-4 animate-spin text-brand-600" /> Loading post…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <Link href="/admin/blog" className="text-[0.72rem] font-bold text-brand-700 hover:text-brand-500">
          ← All posts
        </Link>
        <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[0.8rem] font-semibold text-rose-700">
          {loadError}
        </p>
      </div>
    );
  }

  const busy = saving || actionPending !== null;
  const stateLabel = saving ? "Saving…" : dirty ? "Unsaved changes" : lastSavedAt ? `Saved at ${lastSavedAt}` : "Not saved yet";
  const stateTone = saving ? "text-brand-700" : dirty ? "text-amber-700" : "text-mint-700";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <Link href="/admin/blog" className="text-[0.72rem] font-bold text-brand-700 transition-colors hover:text-brand-500">
            ← All posts
          </Link>
          <BlogStatusBadge status={draft.status} />
          {id !== null && <span className="text-[0.68rem] font-semibold text-ink-600/70">Post #{id}</span>}
          <span aria-live="polite" className={`text-[0.68rem] font-semibold ${stateTone}`}>
            {stateLabel}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-full bg-night-soft px-4 py-2.5 text-[0.72rem] font-bold text-white transition-colors hover:bg-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
          </button>
          {id !== null && (
            <Link
              href={`/admin/blog/preview/${id}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-mist-200 bg-surface px-4 py-2.5 text-[0.72rem] font-bold text-ink-800 transition-colors hover:border-brand-300"
            >
              <Eye className="h-3.5 w-3.5" /> Preview
            </Link>
          )}
          {draft.status === "published" && (
            <a
              href={`/blog/${draft.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-mist-200 bg-surface px-4 py-2.5 text-[0.72rem] font-bold text-ink-800 transition-colors hover:border-brand-300"
            >
              <ExternalLink className="h-3.5 w-3.5" /> View live
            </a>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[0.78rem] font-semibold text-rose-700">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-2xl border border-mint-200 bg-mint-50 px-4 py-3 text-[0.78rem] font-semibold text-mint-700">
          {notice}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          <section className="rounded-2xl border border-mist-200 bg-surface p-4 sm:p-5">
            <label className="block">
              <span className={labelClass}>Title</span>
              <input
                type="text"
                value={draft.title}
                onChange={(event) => handleTitleChange(event.target.value)}
                placeholder="Write a clear article title"
                maxLength={240}
                className="mt-1.5 w-full rounded-xl border border-mist-200 bg-surface px-3.5 py-3 text-[1.15rem] font-extrabold tracking-tight text-ink-950 outline-none transition-colors placeholder:font-bold placeholder:text-ink-600/40 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
            </label>

            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <label className="block">
                <span className={labelClass}>Slug</span>
                <div className="mt-1.5 flex items-center rounded-xl border border-mist-200 bg-surface focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100">
                  <span className="shrink-0 pl-3 text-[0.78rem] font-semibold text-ink-600/60">/blog/</span>
                  <input
                    type="text"
                    value={draft.slug}
                    onChange={(event) => handleSlugChange(event.target.value)}
                    placeholder={slugifyText(draft.title) || "post"}
                    maxLength={120}
                    className="w-full rounded-r-xl border-0 bg-transparent px-1.5 py-2.5 text-[0.82rem] font-semibold text-ink-900 outline-none placeholder:text-ink-600/40"
                  />
                </div>
              </label>
              <button
                type="button"
                onClick={regenerateSlug}
                className="rounded-xl border border-mist-200 bg-surface px-3.5 py-2.5 text-[0.7rem] font-bold text-ink-700 transition-colors hover:border-brand-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
              >
                From title
              </button>
            </div>

            <label className="mt-3 block">
              <span className={labelClass}>Excerpt</span>
              <textarea
                value={draft.excerpt}
                onChange={(event) => updateDraft("excerpt", event.target.value)}
                rows={2}
                maxLength={500}
                placeholder="One or two sentences shown in listings and search results."
                className={inputClass}
              />
            </label>
          </section>

          <section className="overflow-hidden rounded-2xl border border-mist-200 bg-surface">
            <div role="tablist" aria-label="Editor sections" className="flex items-center gap-1 border-b border-mist-100 px-2 py-1.5">
              <TabButton active={tab === "content"} onClick={() => setTab("content")}>
                Content
              </TabButton>
              <TabButton active={tab === "seo"} onClick={() => setTab("seo")}>
                SEO
              </TabButton>
            </div>

            {tab === "content" ? (
              <>
                <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-0.5 border-b border-mist-100 px-2 py-1.5">
                  <ToolButton label="Paragraph" onClick={() => runCommand("formatBlock", "<p>")}>
                    <AlignLeft className="h-4 w-4" />
                  </ToolButton>
                  <ToolButton label="Heading 2" onClick={() => runCommand("formatBlock", "<h2>")}>
                    <Heading2 className="h-4 w-4" />
                  </ToolButton>
                  <ToolButton label="Heading 3" onClick={() => runCommand("formatBlock", "<h3>")}>
                    <Heading3 className="h-4 w-4" />
                  </ToolButton>
                  <ToolButton label="Heading 4" onClick={() => runCommand("formatBlock", "<h4>")}>
                    <Heading4 className="h-4 w-4" />
                  </ToolButton>
                  <ToolbarDivider />
                  <ToolButton label="Bold" onClick={() => runCommand("bold")}>
                    <Bold className="h-4 w-4" />
                  </ToolButton>
                  <ToolButton label="Italic" onClick={() => runCommand("italic")}>
                    <Italic className="h-4 w-4" />
                  </ToolButton>
                  <ToolButton label="Underline" onClick={() => runCommand("underline")}>
                    <Underline className="h-4 w-4" />
                  </ToolButton>
                  <ToolButton label="Strikethrough" onClick={() => runCommand("strikeThrough")}>
                    <Strikethrough className="h-4 w-4" />
                  </ToolButton>
                  <ToolbarDivider />
                  <ToolButton label="Ordered list" onClick={() => runCommand("insertOrderedList")}>
                    <ListOrdered className="h-4 w-4" />
                  </ToolButton>
                  <ToolButton label="Bulleted list" onClick={() => runCommand("insertUnorderedList")}>
                    <List className="h-4 w-4" />
                  </ToolButton>
                  <ToolButton label="Blockquote" onClick={() => runCommand("formatBlock", "<blockquote>")}>
                    <Quote className="h-4 w-4" />
                  </ToolButton>
                  <ToolbarDivider />
                  <ToolButton label="Insert link" onClick={addLink}>
                    <Link2 className="h-4 w-4" />
                  </ToolButton>
                  <ToolButton label="Insert table" onClick={insertTable}>
                    <Table2 className="h-4 w-4" />
                  </ToolButton>
                  <ToolButton label="Horizontal rule" onClick={() => runCommand("insertHorizontalRule")}>
                    <Minus className="h-4 w-4" />
                  </ToolButton>
                  <ToolButton label="Insert image" onClick={() => setMediaOpen(true)}>
                    <ImagePlus className="h-4 w-4" />
                  </ToolButton>
                  <ToolbarDivider />
                  <ToolButton label="Undo" onClick={() => runCommand("undo")}>
                    <Undo2 className="h-4 w-4" />
                  </ToolButton>
                  <ToolButton label="Redo" onClick={() => runCommand("redo")}>
                    <Redo2 className="h-4 w-4" />
                  </ToolButton>
                </div>

                <div
                  ref={contentRef}
                  contentEditable
                  suppressContentEditableWarning
                  role="textbox"
                  aria-multiline="true"
                  aria-label="Article content"
                  spellCheck
                  onInput={handleContentInput}
                  onPaste={handlePaste}
                  className="prose-knight min-h-[26rem] max-w-none px-5 py-4 outline-none focus:bg-brand-50/20 [&_a]:text-brand-700 [&_a]:underline [&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-brand-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_code]:rounded [&_code]:bg-mist-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.85em] [&_figcaption]:mt-1.5 [&_figcaption]:text-center [&_figcaption]:text-[0.72rem] [&_figcaption]:text-ink-600/70 [&_figure]:my-5 [&_figure]:space-y-2 [&_h4]:mt-6 [&_h4]:text-[1.05rem] [&_h4]:font-extrabold [&_h4]:text-ink-900 [&_hr]:my-6 [&_hr]:border-mist-200 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-xl [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-6 [&_table]:my-5 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-mist-200 [&_td]:px-3 [&_td]:py-2 [&_td]:text-left [&_th]:border [&_th]:border-mist-200 [&_th]:bg-mist-50 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left"
                />
              </>
            ) : (
              <div className="space-y-4 p-4 sm:p-5">
                <Field label="SEO title" hint="Up to 70 characters. Falls back to the post title.">
                  <input type="text" value={draft.seoTitle} onChange={(event) => updateDraft("seoTitle", event.target.value)} maxLength={70} placeholder="Search-result headline" aria-label="SEO title" className={inputClass} />
                </Field>
                <Field label="Meta description" hint="Up to 200 characters. Falls back to the excerpt.">
                  <textarea value={draft.seoDescription} onChange={(event) => updateDraft("seoDescription", event.target.value)} rows={3} maxLength={200} placeholder="One compelling sentence for search engines." aria-label="Meta description" className={inputClass} />
                </Field>
                <Field label="Canonical URL" hint="Leave blank to use the public article URL.">
                  <input type="url" value={draft.canonicalUrl} onChange={(event) => updateDraft("canonicalUrl", event.target.value)} maxLength={400} placeholder="https://www.knightmedicalbilling.com/blog/…" aria-label="Canonical URL" className={inputClass} />
                </Field>
                <Field label="Social share image" hint="Absolute URL used for Open Graph and Twitter cards.">
                  <div className="flex gap-2">
                    <input type="url" value={draft.socialImage} onChange={(event) => updateDraft("socialImage", event.target.value)} maxLength={600} placeholder="https://…/share.jpg" aria-label="Social share image" className={inputClass} />
                    {draft.featuredImage && (
                      <button
                        type="button"
                        onClick={() => updateDraft("socialImage", draft.featuredImage)}
                        className="mt-1.5 shrink-0 rounded-xl border border-mist-200 bg-surface px-3 text-[0.68rem] font-bold text-ink-700 transition-colors hover:border-brand-300"
                      >
                        Use featured
                      </button>
                    )}
                  </div>
                </Field>
                <Field label="Source notes" hint="Internal only: sources, approvals, fact-checks. Never rendered publicly.">
                  <textarea value={draft.sourceNotes} onChange={(event) => updateDraft("sourceNotes", event.target.value)} rows={4} maxLength={4000} placeholder="Notes for the owner and editors." aria-label="Source notes" className={inputClass} />
                </Field>
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-mist-200 bg-surface p-4">
            <h2 className={sectionTitleClass}>Publishing</h2>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[0.74rem] text-ink-600/80">Status</span>
              <BlogStatusBadge status={draft.status} />
            </div>
            <div className="mt-3 space-y-2">
              <SidebarButton onClick={() => void save({ status: "draft" })} disabled={busy}>
                <Save className="h-3.5 w-3.5" /> Save draft
              </SidebarButton>
              <SidebarButton onClick={() => void runAction("publish")} disabled={busy} tone="primary">
                <Send className="h-3.5 w-3.5" /> Publish now
              </SidebarButton>

              <div className="rounded-xl border border-mist-200 bg-mist-50/60 p-2.5">
                <label className="block">
                  <span className={labelClass}>Schedule</span>
                  <input
                    type="datetime-local"
                    value={draft.scheduledFor}
                    onChange={(event) => updateDraft("scheduledFor", event.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-mist-200 bg-surface px-2.5 py-2 text-[0.74rem] text-ink-900 outline-none focus:border-brand-400"
                  />
                </label>
                <button
                  type="button"
                  onClick={schedulePost}
                  disabled={busy || !draft.scheduledFor}
                  className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-mist-200 bg-surface px-3 py-2 text-[0.7rem] font-bold text-ink-800 transition-colors hover:border-brand-300 disabled:opacity-50"
                >
                  <Clock className="h-3.5 w-3.5" /> Schedule post
                </button>
              </div>

              {draft.status === "published" && (
                <SidebarButton onClick={() => void runAction("unpublish")} disabled={busy}>
                  Unpublish
                </SidebarButton>
              )}
              {draft.status !== "trashed" ? (
                <SidebarButton onClick={moveToTrash} disabled={busy} tone="danger">
                  <Trash2 className="h-3.5 w-3.5" /> Move to trash
                </SidebarButton>
              ) : (
                <SidebarButton onClick={() => void runAction("restore")} disabled={busy}>
                  <RotateCcw className="h-3.5 w-3.5" /> Restore from trash
                </SidebarButton>
              )}
              <SidebarButton onClick={() => void runAction("duplicate")} disabled={busy}>
                Duplicate post
              </SidebarButton>
              <SidebarButton onClick={() => void deleteForever()} disabled={busy || id === null} tone="danger">
                Delete forever
              </SidebarButton>
            </div>
            {actionPending && <p className="mt-2 text-[0.68rem] font-semibold text-ink-600/70">Working…</p>}
          </section>

          <section className="rounded-2xl border border-mist-200 bg-surface p-4">
            <h2 className={sectionTitleClass}>Organisation</h2>
            <label className="mt-3 block">
              <span className={labelClass}>Category</span>
              <select value={draft.categoryId} onChange={(event) => updateDraft("categoryId", event.target.value)} className={inputClass}>
                <option value="">Uncategorised</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <fieldset className="mt-3">
              <legend className={labelClass}>Tags</legend>
              {tags.length === 0 ? (
                <p className="mt-1.5 rounded-xl bg-mist-50 px-3 py-2 text-[0.7rem] text-ink-600/70">No tags yet.</p>
              ) : (
                <div className="mt-1.5 max-h-44 space-y-1 overflow-y-auto rounded-xl border border-mist-200 p-2">
                  {tags.map((tag) => (
                    <label key={tag.id} className="flex items-center gap-2 rounded-lg px-1 py-0.5 text-[0.76rem] text-ink-800 hover:bg-mist-50">
                      <input
                        type="checkbox"
                        checked={draft.tagIds.includes(tag.id)}
                        onChange={() => {
                          setDraft((previous) => ({
                            ...previous,
                            tagIds: previous.tagIds.includes(tag.id) ? previous.tagIds.filter((value) => value !== tag.id) : [...previous.tagIds, tag.id],
                          }));
                          markDirty();
                        }}
                        className="h-3.5 w-3.5 rounded border-mist-300 accent-brand-600"
                      />
                      {tag.name}
                    </label>
                  ))}
                </div>
              )}
              <Link href="/admin/blog/categories" className="mt-2 inline-block text-[0.68rem] font-bold text-brand-700 hover:text-brand-500">
                Manage categories &amp; tags →
              </Link>
            </fieldset>

            <label className="mt-3 block">
              <span className={labelClass}>Author</span>
              <input type="text" value={draft.author} onChange={(event) => updateDraft("author", event.target.value)} maxLength={120} className={inputClass} />
            </label>
          </section>

          <section className="rounded-2xl border border-mist-200 bg-surface p-4">
            <h2 className={sectionTitleClass}>Featured image</h2>
            {draft.featuredImage ? (
              <div className="mt-3 space-y-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- imported media and hotlinks are not on the Next image allow-list */}
                <img src={draft.featuredImage} alt={draft.featuredImageAlt || "Featured image preview"} className="aspect-[16/10] w-full rounded-xl border border-mist-200 object-cover" />
                <label className="block">
                  <span className={labelClass}>Alt text</span>
                  <input type="text" value={draft.featuredImageAlt} onChange={(event) => updateDraft("featuredImageAlt", event.target.value)} maxLength={300} className={inputClass} />
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setMediaOpen(true)}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-mist-200 bg-surface px-3 py-2 text-[0.7rem] font-bold text-ink-800 transition-colors hover:border-brand-300"
                  >
                    <ImagePlus className="h-3.5 w-3.5" /> Replace
                  </button>
                  <button
                    type="button"
                    onClick={removeFeaturedImage}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-mist-200 bg-surface px-3 py-2 text-[0.7rem] font-bold text-rose-600 transition-colors hover:border-rose-300"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setMediaOpen(true)}
                className="mt-3 flex w-full flex-col items-center gap-1.5 rounded-xl border border-dashed border-mist-300 bg-mist-50 px-3 py-6 text-[0.74rem] font-bold text-ink-600/80 transition-colors hover:border-brand-300 hover:text-brand-700"
              >
                <ImagePlus className="h-5 w-5" /> Add featured image
              </button>
            )}
          </section>

          {id !== null && updatedAt && (
            <p className="px-1 text-[0.66rem] leading-relaxed text-ink-600/60">
              Last updated {formatDate(updatedAt)} · Autosaves every 15 seconds · Ctrl/Cmd+S saves now.
            </p>
          )}
        </aside>
      </div>

      {mediaOpen && <MediaImportModal onClose={() => setMediaOpen(false)} onUseFeatured={useFeaturedMedia} onInsert={insertMedia} />}
    </div>
  );
}

/* ---------------------------------------------------------------- pieces */

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-[0.72rem] font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500 ${
        active ? "bg-night-soft text-white" : "text-ink-600/80 hover:bg-mist-50 hover:text-ink-900"
      }`}
    >
      {children}
    </button>
  );
}

function ToolButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className="grid h-8 w-8 place-items-center rounded-lg text-ink-700 transition-colors hover:bg-brand-50 hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500"
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <span className="mx-1 h-5 w-px bg-mist-200" aria-hidden="true" />;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="block">
      <span className={labelClass}>{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[0.66rem] leading-relaxed text-ink-600/60">{hint}</span>}
    </div>
  );
}

function SidebarButton({
  onClick,
  disabled,
  tone = "default",
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "primary" | "danger";
  children: ReactNode;
}) {
  const tones: Record<"default" | "primary" | "danger", string> = {
    default: "border-mist-200 bg-surface text-ink-800 hover:border-brand-300",
    primary: "border-transparent bg-night-soft text-white hover:bg-brand-600",
    danger: "border-mist-200 bg-surface text-rose-600 hover:border-rose-300",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex w-full items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-[0.72rem] font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50 ${tones[tone]}`}
    >
      {children}
    </button>
  );
}
