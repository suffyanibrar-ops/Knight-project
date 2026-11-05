/**
 * Text preparation and voice selection for natural-sounding browser speech.
 * Pure functions (no DOM) so they can be unit-tested with Node.
 */

const ABBREVIATIONS: [RegExp, string][] = [
  [/\bA\/R\b/gi, "A R"],
  [/\bAR\b/g, "A R"],
  [/\bRCM\b/g, "R C M"],
  [/\bCPT\b/g, "C P T"],
  [/\bICD-?10\b/gi, "I C D ten"],
  [/\bICD-?9\b/gi, "I C D nine"],
  [/\bEOB\b/g, "E O B"],
  [/\bERA\b/g, "E R A"],
  [/\bEFT\b/g, "E F T"],
  [/\bEDI\b/g, "E D I"],
  [/\bNPI\b/g, "N P I"],
  [/\bMBI\b/g, "M B I"],
  [/\bEHR\b/g, "E H R"],
  [/\bEMR\b/g, "E M R"],
  [/\bDME\b/g, "D M E"],
  [/\bHMO\b/g, "H M O"],
  [/\bPPO\b/g, "P P O"],
  [/\bCBO\b/g, "C B O"],
  [/\bOON\b/g, "out of network"],
  [/\bQ&A\b/gi, "Q and A"],
  [/\b24\/5\b/g, "24 5"],
  [/\b24\/7\b/g, "24 7"],
  [/\bDr\./g, "Doctor"],
  [/\bMr\./g, "Mister"],
  [/\bMrs\./g, "Missus"],
  [/\bMs\./g, "Miss"],
  [/\bapprox\./gi, "approximately"],
  [/\be\.g\./gi, "for example"],
  [/\bi\.e\./gi, "that is"],
  [/\bvs\.?/gi, "versus"],
  [/\betc\./gi, "et cetera"],
  [/\baka\b/gi, "also known as"],
];

/** Convert an answer into clean, speakable prose (no markdown, URLs or symbols). */
export function normalizeForSpeech(text: string): string {
  if (!text) return "";
  let output = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]+)\]\((?:https?:\/\/|\/)[^)]+\)/g, "$1")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/www\.\S+/g, " ")
    .replace(/[*_#>|]/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, ", ")
    .replace(/\s*·\s*/g, ", ")
    .replace(/&/g, " and ")
    .replace(/%/g, " percent")
    .replace(/\bNo\.\s*/g, "Number ")
    .replace(/(\d)[.,](\d{3})(?!\d)/g, "$1$2")
    .replace(/\(([^)]{1,120})\)/g, ", $1,")
    .replace(/\s+/g, " ")
    .trim();

  // Expand abbreviations before punctuation spacing so "e.g." still matches.
  for (const [pattern, replacement] of ABBREVIATIONS) output = output.replace(pattern, replacement);
  return output
    .replace(/\s+([.,!?;:])/g, "$1")
    .replace(/([.,!?;:])(?=[A-Za-z])/g, "$1 ")
    .replace(/,{2,}/g, ",")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export interface SpeechChunk { text: string; rate: number; pitch: number }

/** Split into sentence-sized, naturally paced chunks with light prosody hints. */
export function splitForSpeech(text: string): SpeechChunk[] {
  const normalized = normalizeForSpeech(text);
  if (!normalized) return [];
  const sentences = normalized.match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g) ?? [normalized];
  const chunks: SpeechChunk[] = [];
  for (const raw of sentences) {
    const sentence = raw.trim();
    if (!sentence) continue;
    const isQuestion = /\?\s*$/.test(sentence);
    const isExclamation = /!\s*$/.test(sentence);
    const pitch = isQuestion ? 1.04 : isExclamation ? 1.02 : 0.99;
    if (sentence.length <= 190) {
      chunks.push({ text: sentence, rate: isQuestion ? 1.0 : 0.99, pitch });
      continue;
    }
    const parts = sentence.split(/(?<=[,;:])\s+/);
    let buffer = "";
    for (const part of parts) {
      if ((buffer + " " + part).trim().length > 150 && buffer) {
        chunks.push({ text: buffer.trim(), rate: 0.99, pitch });
        buffer = part;
      } else {
        buffer = `${buffer} ${part}`.trim();
      }
    }
    if (buffer) chunks.push({ text: buffer.trim(), rate: 0.99, pitch });
  }
  return chunks;
}

export interface VoiceLike { name: string; lang: string; localService?: boolean }

const PREMIUM_VOICE_NAMES = [
  "samantha", "ava", "allison", "serena", "karen", "moira", "tessa", "fiona", "aria", "jenny",
  "michelle", "emma", "olivia", "salli", "joanna", "kendra", "ivy", "kimberly", "sara", "amy",
];
const JUNK_VOICE_NAMES = ["albert", "zarvox", "bad news", "bells", "boing", "bubbles", "cellos", "jester", "organ", "superstar", "trinoids", "whisper", "wobble", "bahh", "deranged", "hysterical"];

function voiceScore(voice: VoiceLike, lang: string, preferred: string): number {
  const name = voice.name.toLowerCase();
  const voiceLang = voice.lang.toLowerCase().replace("_", "-");
  const wantedLang = lang.toLowerCase();
  let score = 0;
  if (voiceLang === wantedLang) score += 40;
  else if (voiceLang.split("-")[0] === wantedLang.split("-")[0]) score += 25;
  else return -1000;
  if (preferred && name.includes(preferred)) score += 200;
  if (/natural|neural|enhanced|premium|siri|siri voice/i.test(name)) score += 90;
  if (name.includes("google")) score += 70;
  if (PREMIUM_VOICE_NAMES.some((candidate) => name.includes(candidate))) score += 45;
  if (/microsoft/.test(name)) score += 30;
  if (/compact|eloquence|novelty|robot/i.test(name)) score -= 80;
  if (JUNK_VOICE_NAMES.some((candidate) => name.includes(candidate))) score -= 500;
  if (voice.localService === false) score += 15;
  return score;
}

/**
 * All usable voices for a language, ordered by naturalness. This powers the
 * free voice picker: visitors can choose an installed enhanced/neural voice
 * when their device has one, without any paid TTS service.
 */
export function naturalVoiceOptions<T extends VoiceLike>(voices: T[], lang = "en-US", preferredName = ""): T[] {
  const preferred = preferredName.trim().toLowerCase();
  const seen = new Set<string>();
  return voices
    .filter((voice) => voice.lang.toLowerCase().replace("_", "-").split("-")[0] === lang.slice(0, 2).toLowerCase())
    .filter((voice) => {
      const key = `${voice.name}|${voice.lang}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => voiceScore(b, lang, preferred) - voiceScore(a, lang, preferred));
}

/** Pick the most natural available browser voice (prefers enhanced/neural voices). */
export function chooseBestVoice<T extends VoiceLike>(voices: T[], lang = "en-US", preferredName = ""): T | null {
  if (!voices.length) return null;
  const ranked = [...voices]
    .map((voice) => ({ voice, score: voiceScore(voice, lang, preferredName.trim().toLowerCase()) }))
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.score > 0 ? ranked[0].voice : voices.find((voice) => voice.lang.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase())) ?? null;
}
