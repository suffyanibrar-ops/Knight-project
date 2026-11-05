"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { chooseBestVoice, splitForSpeech } from "./voice-text";

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
        setError("Microphone permission was denied. You can keep chatting by typing.");
        setState("error");
      } else if (event.error === "network") {
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
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
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

  /** Speak an answer with natural chunking, best-available voice and light prosody. */
  const speak = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const chunks = splitForSpeech(text);
    if (!chunks.length) return;
    const synth = window.speechSynthesis;
    const voices = voicesRef.current.length ? voicesRef.current : synth.getVoices();
    const voice = chooseBestVoice(voices, lang, voiceNameRef.current);
    speakingRef.current = true;
    setState((current) => (current === "off" || current === "unsupported" ? current : "speaking"));
    let pending = chunks.length;
    const finishOne = () => {
      pending -= 1;
      if (pending <= 0) {
        // The queue may still be flushing the final utterance.
        window.setTimeout(() => {
          if (!synth.speaking) {
            speakingRef.current = false;
            setState((current) => (current === "off" || current === "unsupported" ? current : "listening"));
          }
        }, 60);
      }
    };
    for (const chunk of chunks) {
      const utterance = new SpeechSynthesisUtterance(chunk.text);
      utterance.lang = voice?.lang ?? lang;
      if (voice) utterance.voice = voice;
      utterance.rate = Math.max(0.6, Math.min(1.4, (rateRef.current || 1) * chunk.rate));
      utterance.pitch = Math.max(0.8, Math.min(1.2, chunk.pitch));
      utterance.volume = 1;
      utterance.onend = finishOne;
      utterance.onerror = finishOne;
      synth.speak(utterance);
    }
  }, [lang]);

  /** Cancel current playback + mark not speaking (used by barge-in and Stop). */
  const interrupt = useCallback(() => {
    stopSpeech();
    setState((current) => (current === "off" || current === "unsupported" ? current : "listening"));
  }, [stopSpeech]);

  useEffect(() => () => { end(); }, [end]);

  return { supported, state, interim, error, muted, start, end, stopSpeech, toggleMute, speak, interrupt, setThinking, setError };
}
