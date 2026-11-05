import { cn } from "@/lib/utils";
import type { BlogStatus } from "./types";

const STATUS_STYLES: Record<BlogStatus, string> = {
  draft: "border-mist-300 bg-mist-100 text-ink-700",
  scheduled: "border-amber-200 bg-amber-50 text-amber-700",
  published: "border-mint-200 bg-mint-50 text-mint-700",
  unpublished: "border-brand-200 bg-brand-50 text-brand-700",
  trashed: "border-rose-200 bg-rose-50 text-rose-600",
};

const STATUS_LABELS: Record<BlogStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  published: "Published",
  unpublished: "Unpublished",
  trashed: "Trashed",
};

export function statusLabel(status: BlogStatus): string {
  return STATUS_LABELS[status] ?? status;
}

export function BlogStatusBadge({ status, className }: { status: BlogStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[0.6rem] font-extrabold uppercase tracking-[0.08em]",
        STATUS_STYLES[status] ?? STATUS_STYLES.draft,
        className,
      )}
    >
      {statusLabel(status)}
    </span>
  );
}
