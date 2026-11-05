"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { chooseBestVoice, naturalVoiceOptions, normalizeForSpeech } from "./voice-text";

/**
 * Browser-native voice stack (no paid speech services):
 *  - SpeechRecognition for streaming-ish STT with interim results
 *  - speechSynthesis for TTS
 *  - WebAudio RMS energy detection for barge-in while the agent speaks
 *
 * Barge-in cancels speech synthesis immediately, aborts the in-flight answer
 * request and starts a new turn from the visitor's new speech. Old audio chunks
 * cannot play afterwards because speechSynthesis.cancel() flushes its queue.
 */

export type VoiceState = "off" | "idle" | "listening" | "thinking" | "speaking" | "error" | "unsupported";

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

const BARGE_RMS = 0.055;
const BARGE_FRAMES = 4;

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

export function useVoice({ onFinalUtterance, onBargeIn, lang = "en-US", rate = 1, voiceName = "" }: UseVoiceOptions) {
  const [state, setState] = useState<VoiceState>("off");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const speakingRef = useRef(false);
  const mutedRef = useRef(false);
  const startedRef = useRef(false);
  const onFinalRef = useRef(onFinalUtterance);
  const onBargeInRef = useRef(onBargeIn);
  const rateRef = useRef(rate);
  const voiceNameRef = useRef(voiceName);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  // Incremented on every stop/interrupt/new speech session. Stale utterance
  // callbacks from a cancelled answer can never put the UI back into a wrong state.
  const speechSessionRef = useRef(0);

  useEffect(() => { onFinalRef.current = onFinalUtterance; }, [onFinalUtterance]);
  useEffect(() => { onBargeInRef.current = onBargeIn; }, [onBargeIn]);
  useEffect(() => { mutedRef.current = muted; }, [muted]);
  useEffect(() => { rateRef.current = rate; }, [rate]);

  // Browsers load the voice list asynchronously; keep a warm cache.
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    const load = () => { voicesRef.current = synth.getVoices(); };
    load();
    synth.addEventListener?.("voiceschanged", load);
    return () => synth.removeEventListener?.("voiceschanged", load);
  }, []);
  useEffect(() => { voiceNameRef.current = voiceName; }, [voiceName]);

  const supported = useSyncExternalStore(
    () => () => undefined,
    () => Boolean(getRecognitionCtor()) && typeof window !== "undefined" && "speechSynthesis" in window,
    () => false,
  );

  const stopAnalyser = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (audioContextRef.current) { audioContextRef.current.close().catch(() => undefined); audioContextRef.current = null; }
    analyserRef.current = null;
    if (streamRef.current) { streamRef.current.getTracks().forEach((track) => track.stop()); streamRef.current = null; }
  }, []);

  /** Start the WebAudio energy monitor used to detect speech during TTS. */
  const startAnalyser = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) return;
      const context = new AudioCtor();
      audioContextRef.current = context;
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
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
        if (speakingRef.current && !mutedRef.current && rms > BARGE_RMS) {
          loudFrames += 1;
          if (loudFrames >= BARGE_FRAMES) {
            loudFrames = 0;
            onBargeInRef.current();
          }
        } else {
          loudFrames = 0;
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      // No analyser (permission denied or unsupported) — recognition still works.
    }
  }, []);

  const startRecognition = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    if (recognitionRef.current && startedRef.current) return;
    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      startedRef.current = true;
      setState((current) => (current === "speaking" ? current : "listening"));
    };
    recognition.onresult = (event) => {
      let interimText = "";
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else interimText += result[0].transcript;
      }
      if (interimText) {
        setInterim(interimText);
        // Speaking + new speech = barge-in, even if the analyser misses it.
        if (speakingRef.current && interimText.trim().split(/\s+/).length >= 1) {
          onBargeInRef.current();
        }
      }
      if (finalText.trim()) {
        setInterim("");
        onFinalRef.current(finalText.trim());
      }
    };
    recognition.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        recognitionRef.current = null;
        startedRef.current = false;
        setError("Microphone permission was denied. You can keep chatting by typing.");
        setState("error");
      } else if (event.error === "network") {
        recognitionRef.current = null;
        startedRef.current = false;
        setError("Speech recognition needs a network connection in this browser. Text chat still works.");
        setState("error");
      }
    };
    recognition.onend = () => {
      startedRef.current = false;
      // Chrome ends recognition after silence; restart while the voice session is open.
      if (recognitionRef.current === recognition) {
        window.setTimeout(() => {
          if (recognitionRef.current === recognition && !mutedRef.current) {
            try { recognition.start(); } catch { /* already started */ }
          }
        }, 250);
      }
    };
    recognitionRef.current = recognition;
    try { recognition.start(); } catch { /* start race */ }
  }, [lang]);

  /** Begin a voice session (must be called from a user gesture). */
  const start = useCallback(async () => {
    setError(null);
    if (!getRecognitionCtor()) { setState("unsupported"); return; }
    setMuted(false);
    mutedRef.current = false;
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

  const stopSpeech = useCallback(() => {
    speechSessionRef.current += 1;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try { window.speechSynthesis.cancel(); } catch { /* browser quirk */ }
    }
    speakingRef.current = false;
  }, []);

  const end = useCallback(() => {
    stopSpeech();
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    startedRef.current = false;
    if (recognition) { try { recognition.abort(); } catch { /* ignore */ } }
    stopAnalyser();
    setInterim("");
    setMuted(false);
    mutedRef.current = false;
    setState("off");
  }, [stopSpeech, stopAnalyser]);

  const setThinking = useCallback(() => { setState((current) => (current === "off" || current === "unsupported" ? current : "thinking")); }, []);

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
    // Ordinary answers (2–3 sentences) become one utterance. Only exceptionally
    // long text is split, and then only at sentence boundaries.
    const chunks = chunkSpeech(clean);
    if (!chunks.length) return;
    speakingRef.current = true;
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
        setState((current) => (current === "off" || current === "unsupported" ? current : "listening"));
      }
    }, Math.max(7000, clean.length * 95));
  }, [lang]);

  /** Cancel current playback + mark not speaking (used by barge-in and Stop). */
  const interrupt = useCallback(() => {
    stopSpeech();
    setState((current) => (current === "off" || current === "unsupported" ? current : "listening"));
  }, [stopSpeech]);

  /** Called when an answer finishes with no speakable text, so UI never sticks on "Thinking". */
  const settle = useCallback(() => {
    setState((current) => (current === "thinking" ? "listening" : current));
  }, []);

  useEffect(() => () => { end(); }, [end]);

  return { supported, state, interim, error, muted, start, end, stopSpeech, toggleMute, speak, getVoices, interrupt, settle, setThinking, setError };
}
