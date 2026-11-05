/** Shared formatting helpers for the public blog. */

/** Short, human date for cards and article headers. */
export function formatPostDate(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Long, human date for the article page. */
export function formatPostDateLong(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

/** "6 min read" (never "0 min"). */
export function readingTimeLabel(minutes: number | null | undefined): string {
  const value = Math.max(1, Math.round(minutes ?? 1));
  return `${value} min read`;
}

/** ISO date for <time dateTime>. */
export function isoDate(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}
