"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { chooseBestVoice, naturalVoiceOptions, normalizeForSpeech } from "./voice-text";

/**
 * Browser-native voice stack (no paid speech services):
 *  - SpeechRecognition for streaming-ish STT with interim results
 *  - speechSynthesis for TTS
 *  - WebAudio RMS energy detection for barge-in while the agent speaks
 *
 * The critical rule in this hook is: a transcript is never forwarded while the
 * agent is speaking. Riley's own output can only cause a turn after an explicit
 * interruption has been accepted; then the next final transcript belongs to the
 * visitor's new turn. This breaks the acoustic feedback loop even when browser
 * echo cancellation is imperfect.
 *
 * Echo cancellation is requested from getUserMedia and its *actual applied*
 * state is read from the audio track. When it is reported unavailable, Riley
 * uses a safe half-duplex fallback: playback is never allowed to become a user
 * turn, and the visible Stop control is the reliable interruption path.
 */

export type VoiceState =
  | "off"
  | "idle"
  | "listening"
  | "user-speaking"
  | "thinking"
  | "speaking"
  | "interrupted"
  | "error"
  | "unsupported";

type AudioMode = "full-duplex" | "half-duplex" | "unknown";

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechRecognitionResultLike };
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type RecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface UseVoiceOptions {
  onFinalUtterance: (text: string) => void;
  onBargeIn: () => void;
  lang?: string;
  /** Speech rate from admin settings (0.6–1.4). */
  rate?: number;
  /** Preferred browser voice name (partial match); empty = auto-select. */
  voiceName?: string;
}

const BARGE_RMS = 0.075;
const BARGE_FRAMES = 7;
const BARGE_WARMUP_MS = 180;
const ECHO_TAIL_MS = 1300;
const BARGE_GRACE_MS = 3000;
const DUPLICATE_WINDOW_MS = 850;

interface UtteranceChunk { text: string; rate: number; pitch: number }

/**
 * Keep an answer in as few utterances as practical. Web Speech inserts a small
 * silence at every utterance boundary; grouping sentences into ~420-character
 * phrases removes most of those gaps while still allowing streaming playback.
 */
function chunkSpeech(clean: string): UtteranceChunk[] {
  const max = 420;
  if (clean.length <= max) {
    return [{ text: clean, rate: 0.97, pitch: /\?\s*$/.test(clean) ? 1.03 : 0.99 }];
  }
  const sentences = clean.match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g) ?? [clean];
  const chunks: UtteranceChunk[] = [];
  let buffer = "";
  const push = (text: string) => {
    const trimmed = text.trim();
    if (trimmed) chunks.push({ text: trimmed, rate: 0.97, pitch: /\?\s*$/.test(trimmed) ? 1.03 : 0.99 });
  };
  for (const raw of sentences) {
    const sentence = raw.trim();
    if (!sentence) continue;
    if (buffer && (buffer + " " + sentence).length > max) {
      push(buffer);
      buffer = sentence;
    } else {
      buffer = `${buffer} ${sentence}`.trim();
    }
  }
  push(buffer);
  return chunks;
}

/** Normalize only for duplicate/echo comparison; never mutate what is sent. */
function normalizeMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** A single-word interruption is only credible for explicit control words. */
function isBargePhrase(text: string): boolean {
  const words = normalizeMatch(text).split(/\s+/).filter(Boolean);
  if (words.length >= 2) return true;
  return /^(stop|wait|no|actually|cancel|hold|quiet)$/i.test(words[0] ?? "");
}

/** Levenshtein-based similarity for whole-phrase echo detection. */
function phraseSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length < 12 || b.length < 12) return 0;
  const rows = b.length + 1;
  const cols = a.length + 1;
  if (rows * cols > 40_000) return 0;
  let previous = new Uint16Array(cols);
  let current = new Uint16Array(cols);
  for (let j = 0; j < cols; j += 1) previous[j] = j;
  for (let i = 1; i < rows; i += 1) {
    current[0] = i;
    for (let j = 1; j < cols; j += 1) {
      const cost = b[i - 1] === a[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
    }
    const swap = previous;
    previous = current;
    current = swap;
  }
  const distance = previous[a.length];
  return 1 - distance / Math.max(a.length, b.length);
}

export function useVoice({ onFinalUtterance, onBargeIn, lang = "en-US", rate = 1, voiceName = "" }: UseVoiceOptions) {
  const [state, setState] = useState<VoiceState>("off");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [audioMode, setAudioMode] = useState<AudioMode>("unknown");
  const [echoCancellation, setEchoCancellation] = useState<boolean | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const recognitionEpochRef = useRef(0);
  const recognitionRestartRef = useRef<() => void>(() => undefined);
  const recognitionRestartTimerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const speakingRef = useRef(false);
  const mutedRef = useRef(false);
  const startedRef = useRef(false);
  const stateRef = useRef<VoiceState>("off");
  const onFinalRef = useRef(onFinalUtterance);
  const onBargeInRef = useRef(onBargeIn);
  const rateRef = useRef(rate);
  const voiceNameRef = useRef(voiceName);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const audioModeRef = useRef<AudioMode>("unknown");
  const speechSessionRef = useRef(0);
  const speakingStartedAtRef = useRef(0);
  const speechEndedAtRef = useRef(0);
  const recentSpokenRef = useRef<string[]>([]);
  const bargeAuthorizedAtRef = useRef(0);
  const bargeViaVadRef = useRef(false);
  const bargeConfirmedRef = useRef(false);
  const lastFinalRef = useRef<{ normalized: string; at: number } | null>(null);
  const noiseFloorRef = useRef(0.018);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { onFinalRef.current = onFinalUtterance; }, [onFinalUtterance]);
  useEffect(() => { onBargeInRef.current = onBargeIn; }, [onBargeIn]);
  useEffect(() => { mutedRef.current = muted; }, [muted]);
  useEffect(() => { rateRef.current = rate; }, [rate]);
  useEffect(() => { voiceNameRef.current = voiceName; }, [voiceName]);

  // Browsers load the voice list asynchronously; keep a warm cache.
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    const load = () => { voicesRef.current = synth.getVoices(); };
    load();
    synth.addEventListener?.("voiceschanged", load);
    return () => synth.removeEventListener?.("voiceschanged", load);
  }, []);

  const supported = useSyncExternalStore(
    () => () => undefined,
    () => Boolean(getRecognitionCtor()) && typeof window !== "undefined" && "speechSynthesis" in window,
    () => false,
  );

  /** True when a transcript is an exact/near-exact repeat of recently spoken TTS. */
  const looksLikeSelfEcho = useCallback((text: string, includeShortExact = false) => {
    const normalized = normalizeMatch(text);
    // Short answers such as "yes", "hello", "good" and "I'm here" are never
    // classified as echo in normal operation. The only exception is an exact
    // match immediately after playback: that is the post-TTS tail guard, not a
    // general short-transcript filter.
    if (!normalized) return false;
    if (!includeShortExact && (normalized.length < 12 || normalized.split(/\s+/).length < 3)) return false;
    for (const spoken of recentSpokenRef.current) {
      const spokenNormalized = normalizeMatch(spoken);
      if (!spokenNormalized) continue;
      if (normalized === spokenNormalized) return true;
      if (normalized.length < 12 || normalized.split(/\s+/).length < 3) continue;
      // A long exact excerpt of Riley's current/previous answer is self-echo.
      if (normalized.split(/\s+/).length >= 4 && spokenNormalized.includes(normalized)) return true;
      if (phraseSimilarity(normalized, spokenNormalized) >= 0.92) return true;
    }
    return false;
  }, []);

  const stopAnalyser = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (audioContextRef.current) {
      try { void audioContextRef.current.close(); } catch { /* already closed */ }
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const stopSpeech = useCallback(() => {
    speechSessionRef.current += 1;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try { window.speechSynthesis.cancel(); } catch { /* browser quirk */ }
    }
    speakingRef.current = false;
    speechEndedAtRef.current = performance.now();
  }, []);

  /**
   * Barge-in is only raised from a genuine-looking transcript or, for a
   * confirmed AEC track, sustained energy after playback warm-up. The callback
   * aborts the answer and we stop/clear every queued TTS utterance immediately.
   */
  const triggerBargeIn = useCallback((source: "vad" | "transcript") => {
    if (!speakingRef.current) return;
    if (bargeAuthorizedAtRef.current) return;
    bargeAuthorizedAtRef.current = performance.now();
    bargeViaVadRef.current = source === "vad";
    bargeConfirmedRef.current = source === "transcript";
    stopSpeech();
    stateRef.current = "interrupted";
    setState("interrupted");
    onBargeInRef.current();
  }, [stopSpeech]);

  /** Start the WebAudio energy monitor used to detect speech during TTS. */
  const startAnalyser = useCallback(async () => {
    stopAnalyser();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: { ideal: 1 },
        },
      });
      streamRef.current = stream;

      // Verify what the browser actually applied, rather than trusting the
      // request. The SpeechRecognition API has no way to accept this stream, so
      // this is a capability signal for the conversation mode, not a guarantee
      // that the STT engine's own capture is echo-free.
      const track = stream.getAudioTracks()[0];
      let appliedEchoCancellation: boolean | null = null;
      try {
        let settings = track?.getSettings?.() as MediaTrackSettings | undefined;
        if (settings && typeof settings.echoCancellation === "boolean") {
          appliedEchoCancellation = settings.echoCancellation;
        }
        if (appliedEchoCancellation !== true && track?.getCapabilities) {
          const capabilities = track.getCapabilities() as MediaTrackCapabilities & {
            echoCancellation?: boolean[] | string[];
          };
          if (Array.isArray(capabilities.echoCancellation) && capabilities.echoCancellation.includes(true)) {
            try {
              await track.applyConstraints({ echoCancellation: true, noiseSuppression: true, autoGainControl: true });
              settings = track.getSettings() as MediaTrackSettings | undefined;
              if (settings && typeof settings.echoCancellation === "boolean") appliedEchoCancellation = settings.echoCancellation;
            } catch { /* keep reported state */ }
          }
        }
      } catch { /* older browser: state remains unknown */ }

      const mode: AudioMode = appliedEchoCancellation === true
        ? "full-duplex"
        : appliedEchoCancellation === false
          ? "half-duplex"
          : "unknown";
      audioModeRef.current = mode;
      setAudioMode(mode);
      setEchoCancellation(appliedEchoCancellation);

      const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) {
        stopAnalyser();
        audioModeRef.current = "half-duplex";
        setAudioMode("half-duplex");
        return;
      }
      const context = new AudioCtor();
      audioContextRef.current = context;
      try { await context.resume(); } catch { /* autoplay/gesture state */ }
      // Deliberately connect microphone → analyser only. TTS is never routed
      // into this graph, and no source is connected to audioContext.destination.
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.fftSize);
      let loudFrames = 0;
      const tick = () => {
        const node = analyserRef.current;
        if (!node) return;
        node.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i += 1) {
          const value = (data[i] - 128) / 128;
          sum += value * value;
        }
        const rms = Math.sqrt(sum / data.length);
        if (!speakingRef.current) {
          // Track a quiet ambient floor only while Riley is not speaking.
          noiseFloorRef.current = Math.min(0.04, Math.max(0.008, noiseFloorRef.current * 0.98 + rms * 0.02));
          loudFrames = 0;
        } else if (!mutedRef.current && audioModeRef.current === "full-duplex") {
          const warm = performance.now() - speakingStartedAtRef.current > BARGE_WARMUP_MS;
          const threshold = Math.max(BARGE_RMS, noiseFloorRef.current * 2.4);
          if (warm && rms > threshold) {
            loudFrames += 1;
            if (loudFrames >= BARGE_FRAMES) {
              loudFrames = 0;
              triggerBargeIn("vad");
            }
          } else {
            loudFrames = 0;
          }
        } else {
          loudFrames = 0;
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      // If microphone access or WebAudio fails, recognition may still work.
      // Mark the session half-duplex so no energy detector can manufacture barge-in.
      stopAnalyser();
      audioModeRef.current = "half-duplex";
      setAudioMode("half-duplex");
      setEchoCancellation(false);
    }
  }, [stopAnalyser, triggerBargeIn]);

  const acceptFinal = useCallback((raw: string) => {
    const text = raw.trim();
    if (!text) return;
    const now = performance.now();

    // Never turn Riley's own speaking into a user turn. Only an explicit,
    // recently authorized barge-in may accept a final while TTS is active.
    if (speakingRef.current && !bargeAuthorizedAtRef.current) return;
    if (bargeAuthorizedAtRef.current && now - bargeAuthorizedAtRef.current > BARGE_GRACE_MS) {
      bargeAuthorizedAtRef.current = 0;
      bargeViaVadRef.current = false;
      return;
    }
    if (!bargeAuthorizedAtRef.current && now - speechEndedAtRef.current < ECHO_TAIL_MS && looksLikeSelfEcho(text, true)) {
      return;
    }
    // A VAD-triggered stop is only allowed to become a turn once a non-echo
    // interim result confirms that a person was actually speaking.
    if (bargeAuthorizedAtRef.current && bargeViaVadRef.current && !bargeConfirmedRef.current) {
      bargeAuthorizedAtRef.current = 0;
      bargeConfirmedRef.current = false;
      bargeViaVadRef.current = false;
      return;
    }
    // Ignore delayed results from the previous turn while its answer is being
    // generated or spoken. A genuine barge-in is the only exception above.
    if (stateRef.current === "thinking") return;

    const normalized = normalizeMatch(text);
    const previous = lastFinalRef.current;
    if (previous && previous.normalized === normalized && now - previous.at < DUPLICATE_WINDOW_MS) return;

    // If VAD stopped playback but the STT result is a long exact echo, do not
    // manufacture a new user turn from the speaker. Transcript-based barge-in
    // remains accepted even when the visitor uses words Riley used.
    if (bargeAuthorizedAtRef.current && looksLikeSelfEcho(text, true)) {
      // This applies to both VAD- and transcript-triggered interruptions: an
      // exact/near-exact repeat of Riley's own speech is still echo, not a
      // visitor turn. Legitimate short replies that are not exact playback
      // matches are not filtered here.
      bargeAuthorizedAtRef.current = 0;
      bargeViaVadRef.current = false;
      bargeConfirmedRef.current = false;
      return;
    }

    lastFinalRef.current = { normalized, at: now };
    bargeAuthorizedAtRef.current = 0;
    bargeViaVadRef.current = false;
    bargeConfirmedRef.current = false;
    setInterim("");
    stateRef.current = "thinking";
    setState("thinking");

    // Close the recognition generation that produced this final. Any delayed
    // result from that generation is now invalid, so it cannot create a second
    // turn after the answer has started. A fresh recognizer is started for
    // interruptions while Riley thinks/speaks.
    const previousRecognition = recognitionRef.current;
    recognitionEpochRef.current += 1;
    recognitionRef.current = null;
    startedRef.current = false;
    if (previousRecognition) {
      try { previousRecognition.abort(); } catch { /* already closed */ }
    }
    if (recognitionRestartTimerRef.current !== null) window.clearTimeout(recognitionRestartTimerRef.current);
    recognitionRestartTimerRef.current = window.setTimeout(() => {
      recognitionRestartTimerRef.current = null;
      if (stateRef.current !== "off" && stateRef.current !== "unsupported" && stateRef.current !== "error") {
        recognitionRestartRef.current();
      }
    }, 160);

    onFinalRef.current(text);
  }, [looksLikeSelfEcho]);

  const startRecognition = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    if (recognitionRef.current && startedRef.current) return;
    const recognition = new Ctor();
    const epoch = ++recognitionEpochRef.current;
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      if (recognitionRef.current !== recognition || epoch !== recognitionEpochRef.current) return;
      startedRef.current = true;
      if (!speakingRef.current && stateRef.current !== "thinking" && stateRef.current !== "error") {
        stateRef.current = "listening";
        setState("listening");
      }
    };
    recognition.onresult = (event) => {
      // A recognition instance/epoch mismatch means this result belongs to an
      // ended or superseded session. Never let it create a turn.
      if (recognitionRef.current !== recognition || epoch !== recognitionEpochRef.current) return;
      let interimText = "";
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else interimText += result[0].transcript;
      }
      if (interimText.trim()) {
        const spoken = interimText.trim();
        if (speakingRef.current) {
          // While Riley speaks, only a different-looking interim can authorize
          // barge-in. A similar interim is the agent's own voice returning via
          // the microphone and is discarded before it can create a turn.
          if (audioModeRef.current === "half-duplex") return;
          if (looksLikeSelfEcho(spoken)) return;
          if (isBargePhrase(spoken)) triggerBargeIn("transcript");
          return;
        }
        if (stateRef.current === "thinking") return;
        if (bargeAuthorizedAtRef.current && !looksLikeSelfEcho(spoken)) {
          // This is the non-echo confirmation needed after a VAD-triggered stop.
          bargeConfirmedRef.current = true;
        }
        setInterim(spoken);
        stateRef.current = "user-speaking";
        setState("user-speaking");
      }
      if (finalText.trim()) {
        // Never forward a final while Riley is speaking unless a genuine-looking
        // interim has already authorized this interruption.
        acceptFinal(finalText);
      }
    };
    recognition.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        recognitionRef.current = null;
        startedRef.current = false;
        setError("Microphone permission was denied. You can keep chatting by typing.");
        stateRef.current = "error";
        setState("error");
      } else if (event.error === "network") {
        recognitionRef.current = null;
        startedRef.current = false;
        setError("Speech recognition needs a network connection in this browser. Text chat still works.");
        stateRef.current = "error";
        setState("error");
      }
    };
    recognition.onend = () => {
      startedRef.current = false;
      // Chrome ends recognition after silence; restart while the voice session is open.
      if (recognitionRef.current === recognition && epoch === recognitionEpochRef.current) {
        window.setTimeout(() => {
          if (recognitionRef.current === recognition && epoch === recognitionEpochRef.current && !mutedRef.current) {
            try { recognition.start(); } catch { /* already started */ }
          }
        }, 250);
      }
    };
    recognitionRef.current = recognition;
    try { recognition.start(); } catch { /* start race */ }
  }, [acceptFinal, lang, looksLikeSelfEcho, triggerBargeIn]);

  useEffect(() => { recognitionRestartRef.current = startRecognition; }, [startRecognition]);

  /** Begin a voice session (must be called from a user gesture). */
  const start = useCallback(async () => {
    setError(null);
    if (!getRecognitionCtor()) { setState("unsupported"); return; }
    setMuted(false);
    mutedRef.current = false;
    stateRef.current = "listening";
    setState("listening");
    await startAnalyser();
    startRecognition();
  }, [startAnalyser, startRecognition]);

  /** Pause/resume listening without ending the session. */
  const toggleMute = useCallback(() => {
    setMuted((current) => {
      const next = !current;
      mutedRef.current = next;
      if (recognitionRef.current) {
        if (next) recognitionRef.current.stop();
        else { try { recognitionRef.current.start(); } catch { /* running */ } }
      }
      return next;
    });
  }, []);

  const end = useCallback(() => {
    stopSpeech();
    bargeAuthorizedAtRef.current = 0;
    bargeViaVadRef.current = false;
    bargeConfirmedRef.current = false;
    if (recognitionRestartTimerRef.current !== null) {
      window.clearTimeout(recognitionRestartTimerRef.current);
      recognitionRestartTimerRef.current = null;
    }
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    recognitionEpochRef.current += 1;
    startedRef.current = false;
    if (recognition) { try { recognition.abort(); } catch { /* ignore */ } }
    stopAnalyser();
    setInterim("");
    setMuted(false);
    mutedRef.current = false;
    audioModeRef.current = "unknown";
    setAudioMode("unknown");
    setEchoCancellation(null);
    stateRef.current = "off";
    setState("off");
  }, [stopSpeech, stopAnalyser]);

  const setThinking = useCallback(() => {
    setState((current) => {
      const next = current === "off" || current === "unsupported" ? current : "thinking";
      stateRef.current = next;
      return next;
    });
  }, []);

  /**
   * Speak a complete batch as one natural utterance.
   *
   * The chat widget batches at least two completed sentences (or the end of the
   * answer) before calling this. Speaking whole phrases in one utterance avoids
   * the noticeable silence Chrome/Edge insert between many tiny utterances while
   * preserving natural sentence pauses inside the text.
   */
  const getVoices = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
    const synth = window.speechSynthesis;
    const voices = voicesRef.current.length ? voicesRef.current : synth.getVoices();
    return naturalVoiceOptions(voices, lang, voiceNameRef.current);
  }, [lang]);

  const speak = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const clean = normalizeForSpeech(text);
    if (!clean) return;
    const synth = window.speechSynthesis;
    if (synth.paused) { try { synth.resume(); } catch { /* ignore */ } }
    const voices = voicesRef.current.length ? voicesRef.current : synth.getVoices();
    const voice = chooseBestVoice(voices, lang, voiceNameRef.current);
    const generation = speechSessionRef.current;
    const chunks = chunkSpeech(clean);
    if (!chunks.length) return;

    // This text is the reference used only to reject near-exact acoustic echo.
    recentSpokenRef.current = [...recentSpokenRef.current, clean].slice(-4);
    speakingRef.current = true;
    speakingStartedAtRef.current = performance.now();
    speechEndedAtRef.current = 0;
    bargeAuthorizedAtRef.current = 0;
    bargeViaVadRef.current = false;
    bargeConfirmedRef.current = false;
    if (stateRef.current !== "off" && stateRef.current !== "unsupported") stateRef.current = "speaking";
    setState((current) => (current === "off" || current === "unsupported" ? current : "speaking"));

    let pending = chunks.length;
    let settled = false;
    const finish = () => {
      if (pending > 0) pending -= 1;
      if (pending > 0 || settled) return;
      // Give the browser queue a moment to move to the next queued batch.
      window.setTimeout(() => {
        if (generation !== speechSessionRef.current) return;
        if (!synth.speaking) {
          settled = true;
          speakingRef.current = false;
          speechEndedAtRef.current = performance.now();
          bargeAuthorizedAtRef.current = 0;
          bargeViaVadRef.current = false;
          if (stateRef.current !== "off" && stateRef.current !== "unsupported") stateRef.current = "listening";
          setState((current) => (current === "off" || current === "unsupported" ? current : "listening"));
        }
      }, 90);
    };

    for (const chunk of chunks) {
      const utterance = new SpeechSynthesisUtterance(chunk.text);
      utterance.lang = voice?.lang ?? lang;
      if (voice) utterance.voice = voice;
      utterance.rate = Math.max(0.6, Math.min(1.4, (rateRef.current || 1) * (chunk.rate || 0.97)));
      utterance.pitch = Math.max(0.8, Math.min(1.2, chunk.pitch || 0.99));
      utterance.volume = 1;
      utterance.onend = finish;
      utterance.onerror = finish;
      try {
        synth.speak(utterance);
      } catch {
        finish();
      }
    }

    // Safety net: if a browser never fires onend/onerror (a known Web Speech
    // quirk in background tabs), release the UI state rather than getting stuck.
    window.setTimeout(() => {
      if (generation !== speechSessionRef.current || settled) return;
      if (!synth.speaking) {
        settled = true;
        speakingRef.current = false;
        speechEndedAtRef.current = performance.now();
        bargeAuthorizedAtRef.current = 0;
        bargeViaVadRef.current = false;
        if (stateRef.current !== "off" && stateRef.current !== "unsupported") stateRef.current = "listening";
        setState((current) => (current === "off" || current === "unsupported" ? current : "listening"));
      }
    }, Math.max(7000, clean.length * 95));
  }, [lang]);

  /** Cancel current playback + mark not speaking (used by barge-in and Stop). */
  const interrupt = useCallback(() => {
    stopSpeech();
    setState((current) => {
      const next = current === "off" || current === "unsupported" ? current : "listening";
      stateRef.current = next;
      return next;
    });
  }, [stopSpeech]);

  /** Called when an answer finishes with no speakable text, so UI never sticks on "Thinking". */
  const settle = useCallback(() => {
    setState((current) => {
      const next = current === "thinking" ? "listening" : current;
      stateRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => () => { end(); }, [end]);

  return {
    supported,
    state,
    interim,
    error,
    muted,
    audioMode,
    echoCancellation,
    start,
    end,
    stopSpeech,
    toggleMute,
    speak,
    getVoices,
    interrupt,
    settle,
    setThinking,
    setError,
  };
}
