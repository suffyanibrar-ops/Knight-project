import "server-only";
import { getSetting, setSetting } from "./sqlite";

/**
 * Runtime configuration for the public AI agent. Editable from the admin
 * console, stored in the existing `settings` table, with safe defaults.
 * Security-relevant rules live in `ai-prompt.ts` and are NOT editable.
 */
export const AI_SETTING_KEYS = {
  enabled: "ai.enabled",
  agentName: "ai.agent_name",
  welcome: "ai.welcome",
  tone: "ai.tone",
  instructions: "ai.instructions",
  voiceEnabled: "ai.voice_enabled",
  voiceRate: "ai.voice_rate",
  voiceName: "ai.voice_name",
  handoffEmail: "ai.handoff_email",
  notificationEmail: "ai.notification_email",
  retentionDays: "ai.retention_days",
  bookingEnabled: "ai.booking_enabled",
} as const;

export interface AiSettings {
  enabled: boolean;
  agentName: string;
  welcome: string;
  tone: string;
  instructions: string;
  voiceEnabled: boolean;
  voiceRate: number;
  voiceName: string;
  handoffEmail: string;
  notificationEmail: string;
  retentionDays: number;
  bookingEnabled: boolean;
}

export const AI_DEFAULTS: AiSettings = {
  enabled: process.env.AI_AGENT_ENABLED !== "false",
  agentName: "Riley",
  welcome: "Hi, I'm Riley from Knight Medical Billing. I can answer questions about our medical billing and revenue cycle services, or help you book a free 15-minute intro call. How can I help?",
  tone: "Professional, warm and concise. Sound like an experienced billing consultant, not a call-centre script.",
  instructions:
    "Prioritise understanding the visitor's practice, specialty and billing challenge. Explain how Knight can help, then offer a 15-minute intro call. Keep replies short enough to be spoken aloud. Ask at most one question at a time.",
  voiceEnabled: true,
  voiceRate: 1,
  voiceName: "",
  handoffEmail: process.env.ADMIN_EMAIL ?? "",
  notificationEmail: process.env.ADMIN_EMAIL ?? "",
  retentionDays: Math.max(1, Math.min(365, Number(process.env.AI_TRANSCRIPT_RETENTION_DAYS ?? 90) || 90)),
  bookingEnabled: true,
};

function boolValue(value: string | null, fallback: boolean): boolean {
  if (value === null) return fallback;
  return value === "true" || value === "1";
}

function intValue(value: string | null, fallback: number, min: number, max: number): number {
  if (value === null) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

export function getAiSettings(): AiSettings {
  try {
    const read = (key: string) => getSetting(key);
    const rate = Number(read(AI_SETTING_KEYS.voiceRate) ?? AI_DEFAULTS.voiceRate);
    return {
      enabled: boolValue(read(AI_SETTING_KEYS.enabled), AI_DEFAULTS.enabled),
      agentName: read(AI_SETTING_KEYS.agentName)?.slice(0, 40) || AI_DEFAULTS.agentName,
      welcome: read(AI_SETTING_KEYS.welcome)?.slice(0, 600) || AI_DEFAULTS.welcome,
      tone: read(AI_SETTING_KEYS.tone)?.slice(0, 600) || AI_DEFAULTS.tone,
      instructions: read(AI_SETTING_KEYS.instructions)?.slice(0, 4000) ?? AI_DEFAULTS.instructions,
      voiceEnabled: boolValue(read(AI_SETTING_KEYS.voiceEnabled), AI_DEFAULTS.voiceEnabled),
      voiceRate: Number.isFinite(rate) ? Math.max(0.6, Math.min(1.4, rate)) : AI_DEFAULTS.voiceRate,
      voiceName: read(AI_SETTING_KEYS.voiceName)?.slice(0, 120) ?? AI_DEFAULTS.voiceName,
      handoffEmail: read(AI_SETTING_KEYS.handoffEmail)?.slice(0, 200) || AI_DEFAULTS.handoffEmail,
      notificationEmail: read(AI_SETTING_KEYS.notificationEmail)?.slice(0, 200) || AI_DEFAULTS.notificationEmail,
      retentionDays: intValue(read(AI_SETTING_KEYS.retentionDays), AI_DEFAULTS.retentionDays, 1, 365),
      bookingEnabled: boolValue(read(AI_SETTING_KEYS.bookingEnabled), AI_DEFAULTS.bookingEnabled),
    };
  } catch {
    return AI_DEFAULTS;
  }
}

export function saveAiSettings(patch: Partial<Record<keyof AiSettings, string | number | boolean>>): void {
  const map: Record<string, string> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    map[AI_SETTING_KEYS[key as keyof typeof AI_SETTING_KEYS]] = typeof value === "boolean" ? String(value) : String(value);
  }
  for (const [key, value] of Object.entries(map)) setSetting(key, value);
}

/** Public-safe subset of the settings (never exposes emails or instructions). */
export function publicAiConfig() {
  const settings = getAiSettings();
  return {
    enabled: settings.enabled,
    agentName: settings.agentName,
    welcome: settings.welcome,
    voiceEnabled: settings.voiceEnabled,
    voiceRate: settings.voiceRate,
    voiceName: settings.voiceName,
    bookingEnabled: settings.bookingEnabled,
  };
}
