"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { chooseBestVoice, naturalVoiceOptions, normalizeForSpeech } from "./voice-text";

/**
 * Browser-native voice stack (no paid speech services):
 *  - SpeechRecognition for streaming-ish STT with interim results
 *  - speechSynthesis for TTS
 *  - WebAudio RMS energy detection for desktop full-duplex barge-in
 *
 * The critical rule in this hook is: a transcript is never forwarded while the
 * agent is speaking. Riley's own output can only cause a turn after an explicit
 * interruption has been accepted; then the next final transcript belongs to the
 * visitor's new turn. This breaks the acoustic feedback loop even when browser
 * echo cancellation is imperfect.
 *
 * Mobile browsers are deliberately kept on a half-duplex path: SpeechRecognition
 * starts directly from the user's tap, no second getUserMedia stream competes
 * with it, recognition is closed while TTS plays and reopened afterwards. Desktop
 * may use full-duplex only when getUserMedia confirms an echo-cancelling track;
 * otherwise it also falls back to half-duplex. The Stop control always remains
 * the reliable interruption path.
 */

export type VoiceState =
  | "off"
  | "starting"
  | "idle"
  | "listening"
  | "user-speaking"
  | "thinking"
  | "speaking"
  | "interrupted"
  | "error"
  | "unsupported";

type AudioMode = "full-duplex" | "half-duplex" | "unknown";

export type MicrophoneAccessResult =
  | { ok: true; label: string }
  | { ok: false; reason: "insecure" | "unsupported" | "denied" | "missing" | "busy" | "error"; message: string };

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

/**
 * Mobile browsers (especially iOS) cannot reliably hold a separate
 * getUserMedia stream while SpeechRecognition owns the microphone. Treat
 * touch/mobile devices as half-duplex and use recognition alone; desktop
 * browsers may probe microphone capabilities for a safe full-duplex mode.
 */
function isMobileBrowser(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return true;
  return navigator.maxTouchPoints > 1 && window.matchMedia?.("(pointer: coarse)").matches === true;
}

function isPermissionError(error: unknown): boolean {
  const name = error instanceof Error ? error.name : "";
  return name === "NotAllowedError" || name === "SecurityError";
}

async function requestMicrophoneStream(): Promise<MediaStream> {
  const media = navigator.mediaDevices;
  if (!media?.getUserMedia) throw new DOMException("Microphone API is not available.", "NotSupportedError");
  const strict: MediaStreamConstraints = {
    video: false,
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: { ideal: 1 } },
  };
  try {
    return await media.getUserMedia(strict);
  } catch (first) {
    if (isPermissionError(first)) throw first;
    // Some mobile/embedded browsers reject boolean constraints or channelCount.
    const ideal: MediaStreamConstraints = {
      video: false,
      audio: { echoCancellation: { ideal: true }, noiseSuppression: { ideal: true }, autoGainControl: { ideal: true } },
    };
    try {
      return await media.getUserMedia(ideal);
    } catch (second) {
      if (isPermissionError(second)) throw second;
      return await media.getUserMedia({ video: false, audio: true });
    }
  }
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
  const wantListeningRef = useRef(false);
  const startingRef = useRef(false);
  const mobileRef = useRef(false);
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

  const stopRecognition = useCallback(() => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    recognitionEpochRef.current += 1;
    startedRef.current = false;
    if (recognitionRestartTimerRef.current !== null) {
      window.clearTimeout(recognitionRestartTimerRef.current);
      recognitionRestartTimerRef.current = null;
    }
    if (recognition) {
      try { recognition.abort(); } catch { /* already closed */ }
    }
  }, []);

  const setHalfDuplex = useCallback((reported: boolean | null = false) => {
    audioModeRef.current = "half-duplex";
    setAudioMode("half-duplex");
    setEchoCancellation(reported);
  }, []);

  const stopSpeech = useCallback(() => {
    speechSessionRef.current += 1;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try { window.speechSynthesis.cancel(); } catch { /* browser quirk */ }
    }
    speakingRef.current = false;
    speechEndedAtRef.current = performance.now();
  }, []);

  const requestRecognitionRestart = useCallback((delay = 180) => {
    if (recognitionRestartTimerRef.current !== null) {
      window.clearTimeout(recognitionRestartTimerRef.current);
    }
    recognitionRestartTimerRef.current = window.setTimeout(() => {
      recognitionRestartTimerRef.current = null;
      if (!wantListeningRef.current || mutedRef.current) return;
      if (stateRef.current === "off" || stateRef.current === "unsupported" || stateRef.current === "error") return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      // Half-duplex deliberately keeps the microphone closed while Riley speaks
      // or while an answer is being generated.
      if (audioModeRef.current !== "full-duplex" && (speakingRef.current || stateRef.current === "thinking")) return;
      recognitionRestartRef.current();
    }, delay);
  }, []);

  const resumeAfterTts = useCallback(() => {
    // Restart if this is the half-duplex path, or if a capability probe upgraded
    // to full-duplex after half-duplex already closed the recognizer.
    if (audioModeRef.current !== "full-duplex" || !recognitionRef.current) requestRecognitionRestart(180);
  }, [requestRecognitionRestart]);

  const failVoice = useCallback((message: string) => {
    wantListeningRef.current = false;
    bargeAuthorizedAtRef.current = 0;
    bargeViaVadRef.current = false;
    bargeConfirmedRef.current = false;
    stopRecognition();
    stopAnalyser();
    stopSpeech();
    setInterim("");
    setError(message);
    stateRef.current = "error";
    setState("error");
  }, [stopAnalyser, stopRecognition, stopSpeech]);

  /** True when a transcript is an exact/near-exact repeat of recently spoken TTS. */
  const looksLikeSelfEcho = useCallback((text: string, includeShortExact = false) => {
    const normalized = normalizeMatch(text);
    if (!normalized) return false;
    if (!includeShortExact && (normalized.length < 12 || normalized.split(/\s+/).length < 3)) return false;
    for (const spoken of recentSpokenRef.current) {
      const spokenNormalized = normalizeMatch(spoken);
      if (!spokenNormalized) continue;
      if (normalized === spokenNormalized) return true;
      if (normalized.length < 12 || normalized.split(/\s+/).length < 3) continue;
      if (normalized.split(/\s+/).length >= 4 && spokenNormalized.includes(normalized)) return true;
      if (phraseSimilarity(normalized, spokenNormalized) >= 0.92) return true;
    }
    return false;
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
    // Mobile browsers do not reliably allow a second microphone capture beside
    // SpeechRecognition. They use the half-duplex path and never open one.
    if (mobileRef.current) {
      setHalfDuplex(false);
      return;
    }
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setHalfDuplex(false);
      return;
    }

    let stream: MediaStream | null = null;
    try {
      stream = await requestMicrophoneStream();
      if (!wantListeningRef.current || stateRef.current === "off" || stateRef.current === "error") {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
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

      // Only trust a confirmed echo-cancellation track for full-duplex. If the
      // browser omits the setting, use the safe half-duplex path.
      if (appliedEchoCancellation !== true) {
        stream.getTracks().forEach((item) => item.stop());
        stream = null;
        setHalfDuplex(false);
        return;
      }

      const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) {
        stream.getTracks().forEach((item) => item.stop());
        stream = null;
        setHalfDuplex(false);
        return;
      }
      const context = new AudioCtor();
      audioContextRef.current = context;
      try { await context.resume(); } catch { /* autoplay/gesture state */ }
      if (context.state !== "running") {
        stopAnalyser();
        setHalfDuplex(false);
        return;
      }
      // Deliberately connect microphone → analyser only. TTS is never routed
      // into this graph, and no source is connected to audioContext.destination.
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);
      streamRef.current = stream;
      analyserRef.current = analyser;
      audioModeRef.current = "full-duplex";
      setAudioMode("full-duplex");
      setEchoCancellation(true);
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
      if (stream) stream.getTracks().forEach((item) => item.stop());
      stopAnalyser();
      setHalfDuplex(false);
    }
  }, [setHalfDuplex, stopAnalyser, triggerBargeIn]);

  const pauseRecognitionForTts = useCallback(() => {
    if (audioModeRef.current !== "full-duplex") stopRecognition();
  }, [stopRecognition]);

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

    if (bargeAuthorizedAtRef.current && looksLikeSelfEcho(text, true)) {
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

    // Close the recognition generation that produced this final. A fresh
    // recognizer is only restarted during the answer in full-duplex mode for
    // barge-in; half-duplex stays closed until TTS finishes.
    stopRecognition();
    if (audioModeRef.current === "full-duplex") requestRecognitionRestart(160);

    onFinalRef.current(text);
  }, [looksLikeSelfEcho, requestRecognitionRestart, stopRecognition]);

  const startRecognition = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor || !wantListeningRef.current || mutedRef.current) return;
    if (audioModeRef.current !== "full-duplex" && (speakingRef.current || stateRef.current === "thinking")) return;
    if (recognitionRef.current) return;

    const recognition = new Ctor();
    const epoch = ++recognitionEpochRef.current;
    recognition.lang = lang;
    // Mobile Safari/Chrome can handle a continuous recognizer poorly; restart
    // via onend instead. Desktop keeps continuous mode for natural turns.
    recognition.continuous = !mobileRef.current;
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
          if (audioModeRef.current === "half-duplex") return;
          if (looksLikeSelfEcho(spoken)) return;
          if (isBargePhrase(spoken)) triggerBargeIn("transcript");
          return;
        }
        if (stateRef.current === "thinking") return;
        if (bargeAuthorizedAtRef.current && !looksLikeSelfEcho(spoken)) {
          bargeConfirmedRef.current = true;
        }
        setInterim(spoken);
        stateRef.current = "user-speaking";
        setState("user-speaking");
      }
      if (finalText.trim()) {
        acceptFinal(finalText);
      }
    };

    recognition.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        failVoice("Microphone permission was denied. Enable microphone access for this site in your browser settings, then try again. Text chat still works.");
      } else if (event.error === "audio-capture") {
        failVoice("No usable microphone was found, or another app is using it. Close other audio apps, check your device, and try again.");
      } else if (event.error === "network") {
        failVoice("Voice recognition needs a network connection in this browser. You can keep chatting by text.");
      } else if (event.error === "language-not-supported") {
        failVoice("This browser does not support voice recognition for the selected language. You can keep chatting by text.");
      } else {
        failVoice("Voice could not start on this device. Check that a microphone is connected and allowed, then try again or use text chat.");
      }
    };

    recognition.onend = () => {
      startedRef.current = false;
      if (recognitionRef.current !== recognition || epoch !== recognitionEpochRef.current) return;
      recognitionRef.current = null;
      recognitionEpochRef.current += 1;
      if (!wantListeningRef.current || mutedRef.current) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      if (audioModeRef.current !== "full-duplex" && (speakingRef.current || stateRef.current === "thinking")) return;
      requestRecognitionRestart(250);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (startError) {
      const name = startError instanceof Error ? startError.name : "";
      if (name === "InvalidStateError") return;
      recognitionRef.current = null;
      startedRef.current = false;
      recognitionEpochRef.current += 1;
      failVoice("Voice could not start in this browser. Check microphone access, then try again or use text chat.");
    }
  }, [acceptFinal, failVoice, lang, looksLikeSelfEcho, requestRecognitionRestart, triggerBargeIn]);

  useEffect(() => { recognitionRestartRef.current = startRecognition; }, [startRecognition]);

  /**
   * Prime speech synthesis while handling the user's gesture. iOS Safari and
   * some mobile browsers otherwise block TTS that begins after an async API
   * response.
   */
  const unlock = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    try { if (synth.paused) synth.resume(); } catch { /* ignore */ }
    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const desktopSafari = /Safari/i.test(ua) && !/Chrome|CriOS|Edg|OPR/i.test(ua);
    // Android Chrome does not need a silent TTS utterance and starting one
    // before recognition can steal audio focus from the microphone. Only iOS
    // (and desktop Safari) get the gesture-priming utterance.
    if (!ios && !desktopSafari) return;
    try {
      const utterance = new SpeechSynthesisUtterance(" ");
      utterance.volume = 0;
      utterance.rate = 1;
      utterance.pitch = 1;
      synth.speak(utterance);
    } catch { /* speech unavailable; normal errors surface later */ }
  }, []);

  /**
   * Explicitly request the browser microphone on a user tap.
   *
   * SpeechRecognition owns its own capture. We still need getUserMedia here to
   * guarantee Chrome/Safari show their native permission prompt and to surface
   * the real device error. The probe stream is stopped before recognition starts
   * so Android does not end up with two competing microphone owners.
   */
  const requestMicrophoneAccess = useCallback(async (): Promise<MicrophoneAccessResult> => {
    if (typeof window !== "undefined" && !window.isSecureContext) {
      return { ok: false, reason: "insecure", message: "Microphone access requires HTTPS. Open the secure Knight Medical Billing site and try again." };
    }
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      return { ok: false, reason: "unsupported", message: "This browser does not expose microphone access. Try Chrome or Safari, or continue by text." };
    }
    let stream: MediaStream | null = null;
    try {
      // The explicit call is intentional: this is what triggers Chrome/Safari's
      // native microphone permission prompt on the user's tap.
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const track = stream.getAudioTracks()[0];
      if (!track) {
        stream.getTracks().forEach((item) => item.stop());
        return { ok: false, reason: "missing", message: "No microphone was found on this device. Check that a microphone is available, then try again." };
      }
      const label = track.label?.trim() || "Microphone";
      // Release the probe before SpeechRecognition starts its own capture.
      stream.getTracks().forEach((item) => item.stop());
      stream = null;
      return { ok: true, label };
    } catch (error) {
      if (stream) stream.getTracks().forEach((item) => item.stop());
      const name = error instanceof Error ? error.name : "";
      const detail = error instanceof Error ? error.message : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        if (/dismiss/i.test(detail)) {
          return { ok: false, reason: "denied", message: "The microphone permission prompt was dismissed. Tap Try again when you are ready, or continue by text." };
        }
        return { ok: false, reason: "denied", message: "Microphone permission was denied. In Android Chrome, open the site controls from the address bar, allow Microphone, then tap Riley again. On iPhone, use Settings → Safari → Microphone. Text chat is still available." };
      }
      if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        return { ok: false, reason: "missing", message: "No microphone is connected to this device. Connect or enable a microphone, then try again." };
      }
      if (name === "NotReadableError" || name === "TrackStartError") {
        return { ok: false, reason: "busy", message: "The microphone is already being used by another app. Close the other audio app, then try again." };
      }
      if (name === "OverconstrainedError") {
        return { ok: false, reason: "error", message: "This device could not satisfy the microphone request. Try again or use text chat." };
      }
      return { ok: false, reason: "error", message: "The microphone could not be started. Check your device audio settings and browser permissions, then try again. Text chat is still available." };
    }
  }, []);

  /** Begin a voice session (must be called from a user gesture). */
  const start = useCallback(async () => {
    if (!getRecognitionCtor()) {
      stateRef.current = "unsupported";
      setState("unsupported");
      return false;
    }
    if (typeof window !== "undefined" && !window.isSecureContext) {
      failVoice("Microphone access requires HTTPS. Open the secure site and try voice again, or keep chatting by text.");
      return false;
    }
    if (startingRef.current) return false;
    if (stateRef.current !== "off" && stateRef.current !== "error" && stateRef.current !== "unsupported") return true;
    startingRef.current = true;
    stopSpeech();
    stopRecognition();
    stopAnalyser();
    bargeAuthorizedAtRef.current = 0;
    bargeViaVadRef.current = false;
    bargeConfirmedRef.current = false;
    setError(null);
    setMuted(false);
    mutedRef.current = false;
    wantListeningRef.current = true;
    mobileRef.current = isMobileBrowser();
    const initialMode: AudioMode = mobileRef.current ? "half-duplex" : "unknown";
    audioModeRef.current = initialMode;
    setAudioMode(initialMode);
    setEchoCancellation(mobileRef.current ? false : null);
    stateRef.current = "starting";
    setState("starting");

    // Start recognition synchronously inside the user gesture. Do not await a
    // microphone probe first: mobile browsers lose the gesture and/or reject a
    // second mic capture after the getUserMedia prompt.
    startRecognition();
    if (!mobileRef.current) void startAnalyser();
    startingRef.current = false;
    return true;
  }, [failVoice, startAnalyser, startRecognition, stopAnalyser, stopRecognition, stopSpeech]);

  const toggleMute = useCallback(() => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    if (next) {
      stopRecognition();
    } else if (wantListeningRef.current && !speakingRef.current && stateRef.current !== "thinking") {
      requestRecognitionRestart(80);
    }
  }, [requestRecognitionRestart, stopRecognition]);

  const end = useCallback(() => {
    wantListeningRef.current = false;
    stopSpeech();
    bargeAuthorizedAtRef.current = 0;
    bargeViaVadRef.current = false;
    bargeConfirmedRef.current = false;
    stopRecognition();
    stopAnalyser();
    setInterim("");
    setMuted(false);
    mutedRef.current = false;
    audioModeRef.current = "unknown";
    setAudioMode("unknown");
    setEchoCancellation(null);
    setError(null);
    startingRef.current = false;
    stateRef.current = "off";
    setState("off");
  }, [stopAnalyser, stopRecognition, stopSpeech]);

  const setThinking = useCallback(() => {
    if (audioModeRef.current !== "full-duplex") stopRecognition();
    setState((current) => {
      const next = current === "off" || current === "unsupported" ? current : "thinking";
      stateRef.current = next;
      return next;
    });
  }, [stopRecognition]);

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

    // Close recognition while Riley speaks in half-duplex/unknown mode. This is
    // what prevents the phone speaker from being fed back into STT and is the
    // normal path on mobile devices with limited echo cancellation.
    pauseRecognitionForTts();

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
          resumeAfterTts();
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
        resumeAfterTts();
      }
    }, Math.max(7000, clean.length * 95));
  }, [lang, pauseRecognitionForTts, resumeAfterTts]);

  /** Cancel current playback + mark not speaking (used by barge-in and Stop). */
  const interrupt = useCallback(() => {
    stopSpeech();
    bargeAuthorizedAtRef.current = 0;
    bargeViaVadRef.current = false;
    bargeConfirmedRef.current = false;
    setState((current) => {
      const next = current === "off" || current === "unsupported" ? current : "listening";
      stateRef.current = next;
      return next;
    });
    resumeAfterTts();
  }, [resumeAfterTts, stopSpeech]);

  /** Called when an answer finishes with no speakable text, so UI never sticks on "Thinking". */
  const settle = useCallback(() => {
    setState((current) => {
      const next = current === "thinking" ? "listening" : current;
      stateRef.current = next;
      return next;
    });
    resumeAfterTts();
  }, [resumeAfterTts]);

  // Permission changes must not leave a hidden microphone stream running.
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.permissions?.query) return;
    let cancelled = false;
    let status: PermissionStatus | null = null;
    const onChange = () => {
      if (!cancelled && status?.state === "denied" && wantListeningRef.current) {
        failVoice("Microphone permission was revoked or blocked. Re-enable it in your browser settings, then start voice again. Text chat still works.");
      }
    };
    try {
      void navigator.permissions.query({ name: "microphone" as PermissionName }).then((value) => {
        if (cancelled) return;
        status = value;
        status.onchange = onChange;
        onChange();
      }).catch(() => undefined);
    } catch { /* Permissions API unavailable */ }
    return () => {
      cancelled = true;
      if (status) status.onchange = null;
    };
  }, [failVoice]);

  // Backgrounding a mobile browser suspends recognition/audio. Recover only
  // when visible; never trigger a permission prompt while the page is hidden.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        stopRecognition();
        stopAnalyser();
        return;
      }
      if (!wantListeningRef.current) return;
      const synth = window.speechSynthesis;
      if (synth?.paused) { try { synth.resume(); } catch { /* ignore */ } }
      if (speakingRef.current) {
        if (audioModeRef.current === "full-duplex") void startAnalyser();
        return;
      }
      requestRecognitionRestart(180);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [requestRecognitionRestart, startAnalyser, stopAnalyser, stopRecognition]);

  // Bluetooth/headset route changes: full-duplex can re-acquire its analyser.
  useEffect(() => {
    const media = navigator.mediaDevices;
    if (!media?.addEventListener) return;
    const onDeviceChange = () => {
      if (wantListeningRef.current && audioModeRef.current === "full-duplex") void startAnalyser();
    };
    media.addEventListener("devicechange", onDeviceChange);
    return () => media.removeEventListener("devicechange", onDeviceChange);
  }, [startAnalyser]);

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
    requestMicrophoneAccess,
    unlock,
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
