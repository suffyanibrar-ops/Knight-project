"use client";

import { useState, type FormEvent } from "react";
import { Check, FolderTree, Loader2, Pencil, Plus, Tag, Trash2, X } from "lucide-react";
import { apiFetch, errorMessage } from "./api";
import type { BlogCategoryWithCount, BlogTagWithCount } from "./types";

const inputClass =
  "mt-1.5 w-full rounded-xl border border-mist-200 bg-surface px-3 py-2 text-[0.8rem] text-ink-900 outline-none transition-colors placeholder:text-ink-600/40 focus:border-brand-400 focus:ring-2 focus:ring-brand-100";
const labelClass = "text-[0.6rem] font-extrabold uppercase tracking-[0.12em] text-ink-600/70";
const sectionTitleClass = "flex items-center gap-2 text-[0.95rem] font-extrabold tracking-tight text-ink-950";

type CategoryDraft = { name: string; slug: string; description: string };

/**
 * Create/rename/delete blog categories and tags.
 *
 * Deletes are never optimistic: the API refuses to delete a category that is
 * still assigned to posts, and that message is shown to the owner verbatim.
 */
export function TaxonomyManager({ initialCategories, initialTags }: { initialCategories: BlogCategoryWithCount[]; initialTags: BlogTagWithCount[] }) {
  const [categories, setCategories] = useState<BlogCategoryWithCount[]>(initialCategories);
  const [tags, setTags] = useState<BlogTagWithCount[]>(initialTags);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft>({ name: "", slug: "", description: "" });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<CategoryDraft>({ name: "", slug: "", description: "" });
  const [tagDraft, setTagDraft] = useState<{ name: string; slug: string }>({ name: "", slug: "" });

  async function reload() {
    const [categoryData, tagData] = await Promise.all([
      apiFetch<{ categories: BlogCategoryWithCount[] }>("/api/admin/blog/categories"),
      apiFetch<{ tags: BlogTagWithCount[] }>("/api/admin/blog/tags"),
    ]);
    setCategories(categoryData.categories);
    setTags(tagData.tags);
  }

  function startPending(key: string) {
    setPending(key);
    setError(null);
    setNotice(null);
  }

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!categoryDraft.name.trim()) return;
    startPending("category-create");
    try {
      await apiFetch("/api/admin/blog/categories", {
        method: "POST",
        body: JSON.stringify({
          name: categoryDraft.name.trim(),
          slug: categoryDraft.slug.trim() || undefined,
          description: categoryDraft.description.trim() || undefined,
        }),
      });
      setCategoryDraft({ name: "", slug: "", description: "" });
      setNotice("Category created.");
      await reload();
    } catch (createFailure) {
      setError(errorMessage(createFailure));
    } finally {
      setPending(null);
    }
  }

  function beginEdit(category: BlogCategoryWithCount) {
    setEditingId(category.id);
    setEditDraft({ name: category.name, slug: category.slug, description: category.description ?? "" });
    setError(null);
    setNotice(null);
  }

  async function saveCategory(id: number) {
    if (!editDraft.name.trim()) {
      setError("A category name is required.");
      return;
    }
    startPending(`category-save-${id}`);
    try {
      await apiFetch(`/api/admin/blog/categories/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editDraft.name.trim(),
          slug: editDraft.slug.trim() || undefined,
          description: editDraft.description.trim() || undefined,
        }),
      });
      setEditingId(null);
      setNotice("Category updated.");
      await reload();
    } catch (saveFailure) {
      setError(errorMessage(saveFailure));
    } finally {
      setPending(null);
    }
  }

  async function deleteCategory(category: BlogCategoryWithCount) {
    if (!window.confirm(`Delete the category “${category.name}”?`)) return;
    startPending(`category-delete-${category.id}`);
    try {
      await apiFetch(`/api/admin/blog/categories/${category.id}`, { method: "DELETE" });
      setNotice("Category deleted.");
      await reload();
    } catch (deleteFailure) {
      setError(errorMessage(deleteFailure));
    } finally {
      setPending(null);
    }
  }

  async function createTag(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tagDraft.name.trim()) return;
    startPending("tag-create");
    try {
      await apiFetch("/api/admin/blog/tags", {
        method: "POST",
        body: JSON.stringify({ name: tagDraft.name.trim(), slug: tagDraft.slug.trim() || undefined }),
      });
      setTagDraft({ name: "", slug: "" });
      setNotice("Tag created.");
      await reload();
    } catch (createFailure) {
      setError(errorMessage(createFailure));
    } finally {
      setPending(null);
    }
  }

  async function deleteTag(tag: BlogTagWithCount) {
    if (!window.confirm(`Delete the tag “${tag.name}”? It will be removed from every post that uses it.`)) return;
    startPending(`tag-delete-${tag.id}`);
    try {
      await apiFetch(`/api/admin/blog/tags/${tag.id}`, { method: "DELETE" });
      setNotice("Tag deleted.");
      await reload();
    } catch (deleteFailure) {
      setError(errorMessage(deleteFailure));
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-4">
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

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-mist-200 bg-surface p-5">
          <h2 className={sectionTitleClass}>
            <FolderTree className="h-4 w-4 text-brand-600" /> Categories
          </h2>
          <p className="mt-1 text-[0.74rem] leading-relaxed text-ink-600/70">Group articles by topic. A category that still has posts cannot be deleted.</p>

          <form onSubmit={(event) => void createCategory(event)} className="mt-4 grid gap-2.5 sm:grid-cols-2">
            <label className="block">
              <span className={labelClass}>Name</span>
              <input
                type="text"
                value={categoryDraft.name}
                onChange={(event) => setCategoryDraft((previous) => ({ ...previous, name: event.target.value }))}
                required
                maxLength={120}
                placeholder="e.g. Revenue cycle"
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className={labelClass}>Slug (optional)</span>
              <input
                type="text"
                value={categoryDraft.slug}
                onChange={(event) => setCategoryDraft((previous) => ({ ...previous, slug: event.target.value }))}
                maxLength={120}
                placeholder="auto-generated"
                className={inputClass}
              />
            </label>
            <label className="block sm:col-span-2">
              <span className={labelClass}>Description (optional)</span>
              <input
                type="text"
                value={categoryDraft.description}
                onChange={(event) => setCategoryDraft((previous) => ({ ...previous, description: event.target.value }))}
                maxLength={400}
                placeholder="Shown on the public category archive."
                className={inputClass}
              />
            </label>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={pending !== null || !categoryDraft.name.trim()}
                className="inline-flex items-center gap-1.5 rounded-full bg-night-soft px-4 py-2.5 text-[0.72rem] font-bold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending === "category-create" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Add category
              </button>
            </div>
          </form>

          {categories.length === 0 ? (
            <p className="mt-4 rounded-xl bg-mist-50 px-3 py-3 text-[0.74rem] text-ink-600/70">No categories yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-mist-100">
              {categories.map((category) => (
                <li key={category.id} className="py-2.5">
                  {editingId === category.id ? (
                    <div className="space-y-2">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <input
                          type="text"
                          value={editDraft.name}
                          onChange={(event) => setEditDraft((previous) => ({ ...previous, name: event.target.value }))}
                          aria-label={`Category name for ${category.name}`}
                          maxLength={120}
                          className={inputClass}
                        />
                        <input
                          type="text"
                          value={editDraft.slug}
                          onChange={(event) => setEditDraft((previous) => ({ ...previous, slug: event.target.value }))}
                          aria-label={`Category slug for ${category.name}`}
                          maxLength={120}
                          className={inputClass}
                        />
                      </div>
                      <input
                        type="text"
                        value={editDraft.description}
                        onChange={(event) => setEditDraft((previous) => ({ ...previous, description: event.target.value }))}
                        aria-label={`Category description for ${category.name}`}
                        maxLength={400}
                        placeholder="Description"
                        className={inputClass}
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void saveCategory(category.id)}
                          disabled={pending !== null}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-1.5 text-[0.68rem] font-bold text-brand-700 transition-colors hover:bg-brand-500 hover:text-white disabled:opacity-50"
                        >
                          {pending === `category-save-${category.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-mist-200 px-3 py-1.5 text-[0.68rem] font-bold text-ink-700 transition-colors hover:border-brand-300"
                        >
                          <X className="h-3 w-3" /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[0.8rem] font-extrabold text-ink-950">{category.name}</p>
                        <p className="truncate text-[0.68rem] text-ink-600/70">/blog/category/{category.slug}</p>
                        {category.description && <p className="mt-0.5 line-clamp-2 text-[0.7rem] leading-relaxed text-ink-600/70">{category.description}</p>}
                        <p className="mt-1 text-[0.64rem] font-semibold text-brand-700">
                          {category.postCount} {category.postCount === 1 ? "post" : "posts"}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => beginEdit(category)}
                          aria-label={`Edit category ${category.name}`}
                          title="Edit category"
                          className="grid h-7 w-7 place-items-center rounded-lg text-ink-600/60 transition-colors hover:bg-mist-50 hover:text-ink-900"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteCategory(category)}
                          disabled={pending !== null}
                          aria-label={`Delete category ${category.name}`}
                          title="Delete category"
                          className="grid h-7 w-7 place-items-center rounded-lg text-rose-500 transition-colors hover:bg-rose-50 hover:text-rose-700 disabled:opacity-40"
                        >
                          {pending === `category-delete-${category.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-mist-200 bg-surface p-5">
          <h2 className={sectionTitleClass}>
            <Tag className="h-4 w-4 text-brand-600" /> Tags
          </h2>
          <p className="mt-1 text-[0.74rem] leading-relaxed text-ink-600/70">Lightweight keywords for cross-linking related articles.</p>

          <form onSubmit={(event) => void createTag(event)} className="mt-4 grid gap-2.5 sm:grid-cols-2">
            <label className="block">
              <span className={labelClass}>Name</span>
              <input
                type="text"
                value={tagDraft.name}
                onChange={(event) => setTagDraft((previous) => ({ ...previous, name: event.target.value }))}
                required
                maxLength={80}
                placeholder="e.g. Denials"
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className={labelClass}>Slug (optional)</span>
              <input
                type="text"
                value={tagDraft.slug}
                onChange={(event) => setTagDraft((previous) => ({ ...previous, slug: event.target.value }))}
                maxLength={80}
                placeholder="auto-generated"
                className={inputClass}
              />
            </label>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={pending !== null || !tagDraft.name.trim()}
                className="inline-flex items-center gap-1.5 rounded-full bg-night-soft px-4 py-2.5 text-[0.72rem] font-bold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending === "tag-create" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Add tag
              </button>
            </div>
          </form>

          {tags.length === 0 ? (
            <p className="mt-4 rounded-xl bg-mist-50 px-3 py-3 text-[0.74rem] text-ink-600/70">No tags yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-mist-100">
              {tags.map((tag) => (
                <li key={tag.id} className="flex items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[0.8rem] font-extrabold text-ink-950">{tag.name}</p>
                    <p className="truncate text-[0.68rem] text-ink-600/70">
                      /blog/tag/{tag.slug} · {tag.postCount} {tag.postCount === 1 ? "post" : "posts"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void deleteTag(tag)}
                    disabled={pending !== null}
                    aria-label={`Delete tag ${tag.name}`}
                    title="Delete tag"
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-rose-500 transition-colors hover:bg-rose-50 hover:text-rose-700 disabled:opacity-40"
                  >
                    {pending === `tag-delete-${tag.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
