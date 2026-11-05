"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isAdminAuthenticated, logAdminAction } from "@/lib/auth";
import { saveAiSettings, AI_SETTING_KEYS } from "@/lib/ai-config";
import { addBlockedTime, deleteBlockedTime, saveAvailabilityRule, setAppointmentStatus } from "@/lib/ai-appointments";
import { updateHandoff } from "@/lib/ai-session";
import { localToUtc } from "@/lib/ai-appointments";
import { rebuildKnowledge } from "@/lib/ai-knowledge";
import { getSetting, setSetting } from "@/lib/sqlite";

async function requireAdmin() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
}

export async function toggleAgentAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const enabled = String(formData.get("enabled") ?? "") === "true";
  setSetting(AI_SETTING_KEYS.enabled, String(enabled));
  await logAdminAction("ai.toggle", enabled ? "AI agent enabled" : "AI agent disabled", null);
  revalidatePath("/admin/ai");
}

export async function saveAgentSettingsAction(formData: FormData): Promise<void> {
  await requireAdmin();
  saveAiSettings({
    agentName: String(formData.get("agentName") ?? "").slice(0, 40),
    welcome: String(formData.get("welcome") ?? "").slice(0, 600),
    tone: String(formData.get("tone") ?? "").slice(0, 600),
    instructions: String(formData.get("instructions") ?? "").slice(0, 4000),
    voiceEnabled: formData.get("voiceEnabled") === "on",
    voiceRate: Number(formData.get("voiceRate") ?? 1),
    voiceName: String(formData.get("voiceName") ?? "").slice(0, 120),
    handoffEmail: String(formData.get("handoffEmail") ?? "").slice(0, 200),
    notificationEmail: String(formData.get("notificationEmail") ?? "").slice(0, 200),
    retentionDays: Number(formData.get("retentionDays") ?? 90),
    bookingEnabled: formData.get("bookingEnabled") === "on",
  });
  const booking = {
    "ai.booking_enabled": String(formData.get("bookingEnabled") === "on"),
    "ai.booking_horizon_days": String(formData.get("bookingHorizonDays") ?? "60"),
    "ai.booking_notice_hours": String(formData.get("bookingNoticeHours") ?? "24"),
    "ai.booking_duration_minutes": String(formData.get("bookingDurationMinutes") ?? "15"),
    "ai.booking_buffer_minutes": String(formData.get("bookingBufferMinutes") ?? "15"),
    "ai.booking_timezone": String(formData.get("bookingTimezone") ?? "America/New_York").slice(0, 80),
  };
  for (const [key, value] of Object.entries(booking)) setSetting(key, value);
  await logAdminAction("ai.settings", "AI settings updated", null);
  revalidatePath("/admin/ai/settings");
  revalidatePath("/admin/ai");
}

export async function updateHandoffAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const status = String(formData.get("status") ?? "pending") as "pending" | "in_progress" | "resolved";
  const note = String(formData.get("adminNote") ?? "").slice(0, 2000) || null;
  try {
    updateHandoff(id, status, note);
    await logAdminAction("ai.handoff", `handoff ${id} -> ${status}`, null);
  } catch { /* invalid input ignored */ }
  revalidatePath("/admin/ai/handoffs");
  revalidatePath("/admin/ai");
}

export async function appointmentStatusAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const status = String(formData.get("status")) as "confirmed" | "cancelled";
  try {
    setAppointmentStatus(id, status);
    await logAdminAction("ai.appointment", `appointment ${id} -> ${status}`, null);
  } catch { /* ignore */ }
  revalidatePath("/admin/ai/appointments");
}


export async function saveAvailabilityAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const ids = formData.getAll("ruleId").map((value) => Number(value));
  for (const id of ids) {
    const start = String(formData.get(`start_${id}`) ?? "09:00");
    const end = String(formData.get(`end_${id}`) ?? "17:00");
    const toMinutes = (value: string) => {
      const [hours, minutes] = value.split(":").map(Number);
      return (Number.isFinite(hours) ? hours : 9) * 60 + (Number.isFinite(minutes) ? minutes : 0);
    };
    try {
      saveAvailabilityRule({
        id,
        startMinute: toMinutes(start),
        endMinute: toMinutes(end),
        slotMinutes: 15,
        bufferMinutes: Number(formData.get(`buffer_${id}`) ?? 15),
        active: formData.get(`active_${id}`) === "on",
      });
    } catch { /* skip invalid row */ }
  }
  revalidatePath("/admin/ai/appointments");
}

export async function addBlockedTimeAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const date = String(formData.get("date") ?? "");
  const startTime = String(formData.get("startTime") ?? "09:00");
  const endTime = String(formData.get("endTime") ?? "17:00");
  const reason = String(formData.get("reason") ?? "").slice(0, 200);
  const [year, month, day] = date.split("-").map(Number);
  const toMinutes = (value: string) => { const [h, m] = value.split(":").map(Number); return h * 60 + m; };
  if (!year || !month || !day) return;
  try {
    const start = localToUtc(year, month, day, toMinutes(startTime));
    const end = localToUtc(year, month, day, toMinutes(endTime));
    addBlockedTime({ startsAtUtc: start.getTime(), endsAtUtc: end.getTime(), reason });
    await logAdminAction("ai.blocked-time", `blocked ${date} ${startTime}-${endTime}`, null);
  } catch { /* ignore invalid input */ }
  revalidatePath("/admin/ai/appointments");
}

export async function deleteBlockedTimeAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  try { deleteBlockedTime(id); } catch { /* ignore */ }
  revalidatePath("/admin/ai/appointments");
}

export async function addKnowledgeAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim() || "/";
  if (!title || !content) return;
  const slug = `manual-${Date.now().toString(36)}`;
  try {
    const { sqliteHandle } = await import("@/lib/sqlite");
    const handle = sqliteHandle();
    if (handle) {
      handle.prepare("INSERT INTO ai_knowledge_sources (kind, slug, title, url, content_text, status, created_at, updated_at, last_indexed_at) VALUES ('manual', ?, ?, ?, ?, 'active', ?, ?, ?)")
        .run(slug, title.slice(0, 200), url.slice(0, 400), content.slice(0, 20000), Date.now(), Date.now(), Date.now());
      await rebuildKnowledge();
      await logAdminAction("ai.knowledge", `added manual knowledge: ${title.slice(0, 80)}`, null);
    }
  } catch { /* ignore */ }
  revalidatePath("/admin/ai/knowledge");
}

export async function deleteKnowledgeAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  try {
    const { sqliteHandle } = await import("@/lib/sqlite");
    const handle = sqliteHandle();
    if (handle) {
      handle.prepare("DELETE FROM ai_knowledge_sources WHERE id = ? AND kind = 'manual'").run(id);
      await rebuildKnowledge();
      await logAdminAction("ai.knowledge", `deleted manual knowledge #${id}`, null);
    }
  } catch { /* ignore */ }
  revalidatePath("/admin/ai/knowledge");
}

export async function reindexKnowledgeAction(): Promise<void> {
  await requireAdmin();
  try {
    const result = await rebuildKnowledge();
    await logAdminAction("ai.knowledge", `reindexed ${result.sources} sources / ${result.chunks} chunks`, null);
  } catch { /* ignore */ }
  revalidatePath("/admin/ai/knowledge");
}

