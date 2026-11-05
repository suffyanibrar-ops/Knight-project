import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/auth";
import { knowledgeStatus, listKnowledgeSources } from "@/lib/ai-knowledge";
import { AdminPageHeader } from "@/components/admin/ui";
import { AiBadge, AiDate, AiPanel, adminButton, adminInput, adminLabel } from "@/components/admin/ai/ui";
import { addKnowledgeAction, deleteKnowledgeAction, reindexKnowledgeAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "AI knowledge base · Admin", robots: { index: false, follow: false } };

export default async function AdminAiKnowledgePage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
  const status = knowledgeStatus();
  const sources = listKnowledgeSources(300);
  const counts = sources.reduce<Record<string, number>>((acc, source) => { acc[source.kind] = (acc[source.kind] ?? 0) + 1; return acc; }, {});
  const manual = sources.filter((source) => source.kind === "manual");

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Knowledge base"
        description="The agent answers only from this approved index plus fixed company facts. Rebuild after publishing or editing content."
        actions={<form action={reindexKnowledgeAction}><button type="submit" className={adminButton}>Rebuild index</button></form>}
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-mist-200 bg-surface p-4"><p className="text-[0.58rem] font-extrabold uppercase tracking-wide text-ink-600/60">Sources</p><p className="mt-1 text-xl font-extrabold text-ink-950">{status.sources}</p></div>
        <div className="rounded-2xl border border-mist-200 bg-surface p-4"><p className="text-[0.58rem] font-extrabold uppercase tracking-wide text-ink-600/60">Chunks</p><p className="mt-1 text-xl font-extrabold text-ink-950">{status.chunks}</p></div>
        <div className="rounded-2xl border border-mist-200 bg-surface p-4"><p className="text-[0.58rem] font-extrabold uppercase tracking-wide text-ink-600/60">Manual notes</p><p className="mt-1 text-xl font-extrabold text-ink-950">{status.manualSources}</p></div>
        <div className="rounded-2xl border border-mist-200 bg-surface p-4"><p className="text-[0.58rem] font-extrabold uppercase tracking-wide text-ink-600/60">Last indexed</p><p className="mt-1 text-[0.82rem] font-bold text-ink-950"><AiDate value={status.lastIndexedAt} /></p></div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.4fr]">
        <AiPanel title="Add approved knowledge" description="A manual note, FAQ answer or approved company fact. Injected into retrieval after saving.">
          <form action={addKnowledgeAction} className="space-y-2.5">
            <label className={adminLabel}>Title<input required name="title" maxLength={200} className={adminInput} /></label>
            <label className={adminLabel}>Related URL (optional)<input name="url" maxLength={400} placeholder="/about" className={adminInput} /></label>
            <label className={adminLabel}>Content<textarea required name="content" rows={6} maxLength={20000} placeholder="Approved facts only — no pricing promises or invented results." className={adminInput} /></label>
            <button type="submit" className={adminButton}>Save & reindex</button>
          </form>
          {manual.length > 0 && (
            <ul className="mt-4 space-y-2">
              {manual.map((source) => (
                <li key={source.id} className="rounded-xl border border-mist-200 px-3 py-2">
                  <p className="text-[0.78rem] font-bold text-ink-900">{source.title}</p>
                  <p className="text-[0.66rem] text-ink-600/70">{source.chunkCount} chunks · updated <AiDate value={source.updatedAt} /></p>
                  <form action={deleteKnowledgeAction} className="mt-1"><input type="hidden" name="id" value={source.id} /><button type="submit" className="text-[0.66rem] font-bold text-rose-700 hover:underline">Delete</button></form>
                </li>
              ))}
            </ul>
          )}
        </AiPanel>

        <AiPanel title="Indexed sources" description="Website content is re-ingested automatically; manual notes are preserved on rebuild.">
          <p className="mb-3 flex flex-wrap gap-1.5">{Object.entries(counts).map(([kind, count]) => <AiBadge key={kind} tone="brand">{kind}: {count}</AiBadge>)}</p>
          <div className="max-h-[26rem] overflow-y-auto"><table className="w-full text-left text-[0.72rem]">
            <thead><tr className="sticky top-0 border-b border-mist-200 bg-surface text-[0.56rem] font-extrabold uppercase tracking-[0.1em] text-ink-600/60"><th className="pb-2 pr-2">Kind</th><th className="pb-2 pr-2">Title</th><th className="pb-2 pr-2">URL</th><th className="pb-2">Chunks</th></tr></thead>
            <tbody>{sources.map((source) => (
              <tr key={source.id} className="border-b border-mist-100 last:border-0">
                <td className="py-1.5 pr-2"><AiBadge>{source.kind}</AiBadge></td>
                <td className="py-1.5 pr-2 font-semibold text-ink-800">{source.title}</td>
                <td className="py-1.5 pr-2 text-ink-600/70">{source.url}</td>
                <td className="py-1.5">{source.chunkCount}</td>
              </tr>
            ))}</tbody>
          </table></div>
        </AiPanel>
      </div>
    </div>
  );
}
