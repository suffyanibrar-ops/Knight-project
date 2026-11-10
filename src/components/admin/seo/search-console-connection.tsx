"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, PlugZap, RefreshCw, ShieldCheck, Unplug } from "lucide-react";
import { cn } from "@/components/ui";

type GscStatus = "not_connected" | "connected" | "reconnect_required" | "property_access_unavailable" | "property_selection_required" | "temporarily_unavailable" | "error";
type Property = { siteUrl: string; permissionLevel: string };
type StatusPayload = {
  configured: boolean;
  status: GscStatus;
  source: "oauth" | "service_account" | null;
  siteUrl: string | null;
  properties: Property[];
  accountEmail: string | null;
  connectedAt: string | null;
  checkedAt: string;
  error?: string;
  errorCode?: string;
  retryable?: boolean;
};

const STATUS_COPY: Record<GscStatus, string> = {
  not_connected: "Not connected",
  connected: "Connected",
  reconnect_required: "Reconnect required",
  property_access_unavailable: "Property access unavailable",
  property_selection_required: "Choose a property",
  temporarily_unavailable: "Temporarily unavailable",
  error: "Connection check failed",
};

function statusTone(status: GscStatus) {
  if (status === "connected") return "border-mint-200 bg-mint-50 text-mint-800";
  if (status === "reconnect_required" || status === "property_access_unavailable" || status === "temporarily_unavailable" || status === "error") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-mist-200 bg-mist-50 text-ink-600";
}

export function SearchConsoleConnection() {
  const [data, setData] = useState<StatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/seo/google/status", { cache: "no-store" });
      const body = (await response.json().catch(() => null)) as { ok?: boolean; status?: StatusPayload; error?: string } | null;
      if (response.status === 401) { window.location.assign("/admin/login"); return; }
      if (!response.ok || !body?.ok || !body.status) throw new Error(body?.error ?? "Could not check Search Console.");
      setData(body.status);
      setSelected(body.status.siteUrl ?? "");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not check Search Console.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function saveProperty() {
    if (!selected) { setError("Choose a property first."); return; }
    setBusy("property"); setError(null); setNotice(null);
    try {
      const response = await fetch("/api/admin/seo/google/property", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ siteUrl: selected }) });
      const body = (await response.json().catch(() => null)) as { ok?: boolean; status?: StatusPayload; error?: string } | null;
      if (!response.ok || !body?.ok || !body.status) throw new Error(body?.error ?? "Could not save the property.");
      setData(body.status); setNotice("Search Console property saved."); setBusy(null);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not save the property."); setBusy(null); }
  }

  async function disconnect() {
    if (!window.confirm("Disconnect Google Search Console from Knight? You can reconnect later.")) return;
    setBusy("disconnect"); setError(null); setNotice(null);
    try {
      const response = await fetch("/api/admin/seo/google/disconnect", { method: "POST", headers: { "content-type": "application/json" } });
      const body = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !body?.ok) throw new Error(body?.error ?? "Could not disconnect Search Console.");
      setData({ configured: data?.configured ?? true, status: "not_connected", source: null, siteUrl: null, properties: [], accountEmail: null, connectedAt: null, checkedAt: new Date().toISOString() });
      setSelected(""); setNotice("Search Console disconnected."); setBusy(null);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not disconnect Search Console."); setBusy(null); }
  }

  if (loading) return <div className="flex items-center gap-2 rounded-2xl border border-mist-200 bg-surface p-4 text-[0.74rem] font-semibold text-ink-600"><Loader2 className="h-4 w-4 animate-spin" /> Checking Search Console connection…</div>;

  const status = data?.status ?? "not_connected";
  const connected = status === "connected";
  const properties = data?.properties ?? [];
  const selectedSite = data?.siteUrl ?? "";
  const canConnect = data?.configured !== false && (data?.source === "service_account" || ["not_connected", "reconnect_required", "property_access_unavailable", "error"].includes(status));
  const statusMessage = status === "reconnect_required"
    ? "Google authorization needs to be renewed."
    : status === "property_access_unavailable"
      ? "Search Console property access is unavailable."
      : status === "temporarily_unavailable"
        ? "Search Console is temporarily unavailable. Please try again."
        : status === "error"
          ? "We couldn't verify Search Console right now. Please try again."
          : null;

  return (
    <section className="rounded-2xl border border-mist-200 bg-surface p-4 sm:p-5" aria-labelledby="gsc-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="gsc-title" className="flex items-center gap-2 text-[0.95rem] font-extrabold tracking-tight text-ink-950"><PlugZap className="h-4 w-4 text-brand-600" /> Search Console</h2>
          <p className="mt-1 max-w-2xl text-[0.72rem] leading-relaxed text-ink-600/70">Connect Google Search Console to let Knight read verified clicks, impressions and rankings. Read-only access.</p>
        </div>
        <span className={cn("rounded-full border px-2.5 py-1 text-[0.62rem] font-extrabold", statusTone(status))}>{STATUS_COPY[status]}</span>
      </div>

      {error && <p role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[0.72rem] font-semibold text-rose-700">{error}</p>}
      {notice && <p role="status" className="mt-3 rounded-xl border border-mint-200 bg-mint-50 px-3 py-2 text-[0.72rem] font-semibold text-mint-800">{notice}</p>}
      {!data?.configured && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[0.72rem] leading-relaxed text-amber-900">Search Console OAuth is not configured on this server. Add the Google OAuth environment variables before connecting.</p>}
      {data?.source === "service_account" && <p className="mt-3 rounded-xl border border-brand-100 bg-brand-50/60 px-3 py-2 text-[0.7rem] leading-relaxed text-brand-800">Using the existing service-account fallback. <ShieldCheck className="inline h-3 w-3" /> You can connect an admin Google account to switch to OAuth.</p>}

      {properties.length > 0 && (
        <div className="mt-3 grid gap-2 rounded-xl border border-mist-200 bg-mist-50/50 p-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="block">
            <span className="text-[0.58rem] font-extrabold uppercase tracking-[0.1em] text-ink-600/65">Search Console property</span>
            <select value={selected} onChange={(event) => setSelected(event.target.value)} className="mt-1 w-full rounded-lg border border-mist-200 bg-surface px-2.5 py-2 text-[0.72rem] text-ink-900 outline-none focus:border-brand-400">
              <option value="">Choose the property for this website</option>
              {properties.map((property) => <option key={property.siteUrl} value={property.siteUrl}>{property.siteUrl} · {property.permissionLevel}</option>)}
            </select>
          </label>
          <button type="button" disabled={busy !== null || !selected || selected === selectedSite} onClick={() => void saveProperty()} className="inline-flex items-center gap-1.5 rounded-full bg-night-soft px-3.5 py-2 text-[0.68rem] font-bold text-white hover:bg-brand-600 disabled:opacity-50">{busy === "property" ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />} Save property</button>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {canConnect && data?.configured !== false && <a href="/api/admin/seo/google/connect" className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-3.5 py-2 text-[0.68rem] font-bold text-white hover:bg-brand-700"><ExternalLink className="h-3 w-3" /> {connected ? "Reconnect" : "Connect Search Console"}</a>}
        {connected && <span className="inline-flex items-center gap-1.5 text-[0.66rem] font-bold text-mint-700"><CheckCircle2 className="h-3.5 w-3.5" /> {selectedSite}</span>}
        {data?.source === "oauth" && <button type="button" disabled={busy !== null} onClick={() => void disconnect()} className="inline-flex items-center gap-1.5 rounded-full border border-mist-200 px-3 py-2 text-[0.66rem] font-bold text-ink-600 hover:border-rose-200 hover:text-rose-700 disabled:opacity-50">{busy === "disconnect" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unplug className="h-3 w-3" />} Disconnect</button>}
        <button type="button" disabled={busy !== null} onClick={() => { setLoading(true); setError(null); void load(); }} className="inline-flex items-center gap-1.5 rounded-full border border-mist-200 px-3 py-2 text-[0.66rem] font-bold text-ink-600 hover:border-brand-300 disabled:opacity-50"><RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} /> Refresh status</button>
      </div>

      {statusMessage && <p className="mt-3 flex items-start gap-1.5 text-[0.68rem] leading-relaxed text-amber-800"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {statusMessage}</p>}
      <p className="mt-2 text-[0.62rem] leading-relaxed text-ink-600/55">Only verified data returned by Google is displayed. No impressions, clicks, positions or traffic estimates are generated locally.</p>
    </section>
  );
}
