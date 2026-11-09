"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, MessageCircle, Mic, MicOff, PhoneOff, RefreshCw, ShieldCheck, Square, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef } from "react";
import { site } from "@/lib/site";
import type { VoiceState } from "./use-voice";

type AudioMode = "full-duplex" | "half-duplex" | "unknown";

export interface VoiceCallOverlayProps {
  open: boolean;
  ended: boolean;
  retrying: boolean;
  voiceState: VoiceState;
  voiceError: string | null;
  muted: boolean;
  audioMode: AudioMode;
  agentName: string;
  welcome: string;
  onEnd: () => void;
  onMute: () => void;
  onInterrupt: () => void;
  onText: () => void;
  onRetry: () => void;
  onClose: () => void;
}

function statusFor({ ended, voiceState, voiceError, muted, retrying }: Pick<VoiceCallOverlayProps, "ended" | "voiceState" | "voiceError" | "muted" | "retrying">) {
  if (ended) return { label: "Call ended", detail: "Thanks for talking with Riley. You can call back or continue by text." };
  if (voiceError) {
    const permission = /permission|microphone|denied|blocked|not-allowed/i.test(voiceError);
    return permission
      ? { label: "Permission required", detail: "Allow microphone access for this site, then try the call again. You can also use text." }
      : { label: "Connection issue", detail: voiceError };
  }
  if (muted) return { label: "Muted", detail: "Your microphone is off. Tap Unmute when you are ready to speak." };
  switch (voiceState) {
    case "starting":
      return { label: retrying ? "Reconnecting" : "Connecting", detail: retrying ? "Reconnecting to Riley’s voice session…" : "Connecting your microphone to Riley…" };
    case "listening":
      return { label: "Listening", detail: "Riley is listening. Speak naturally, like a phone call." };
    case "user-speaking":
      return { label: "Listening to you", detail: "I’m listening — take your time." };
    case "thinking":
      return { label: "Riley is thinking", detail: "Riley is working on your question…" };
    case "speaking":
      return { label: "Riley is speaking", detail: "Tap Interrupt at any time to jump in." };
    case "interrupted":
      return { label: "Listening", detail: "Go ahead — Riley is listening." };
    case "unsupported":
      return { label: "Voice not supported", detail: "This browser does not support voice calls. You can continue by text." };
    case "off":
      return ended ? { label: "Call ended", detail: "Thanks for talking with Riley." } : { label: "Connecting", detail: "Starting your voice connection…" };
    default:
      return { label: "Listening", detail: "Speak naturally when you are ready." };
  }
}

export function VoiceCallOverlay(props: VoiceCallOverlayProps) {
  const { open, ended, voiceState, voiceError, muted, audioMode, agentName, welcome, onEnd, onMute, onInterrupt, onText, onRetry, onClose } = props;
  const status = statusFor(props);
  const endRef = useRef<HTMLButtonElement>(null);
  const active = !ended && !voiceError && (voiceState === "starting" || voiceState === "listening" || voiceState === "user-speaking" || voiceState === "thinking" || voiceState === "speaking" || voiceState === "interrupted");

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => endRef.current?.focus(), 250);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (ended) onClose();
        else onEnd();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, ended, onClose, onEnd]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          className="fixed inset-0 z-[70] overflow-y-auto bg-[radial-gradient(120%_100%_at_50%_0%,#0d3850_0%,#061b29_45%,#04141f_100%)] text-white"
          role="dialog"
          aria-modal="true"
          aria-label={`Voice call with ${agentName}`}
          data-voice-state={voiceError ? "error" : voiceState}
          data-voice-mode={audioMode}
        >
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -left-24 top-20 h-72 w-72 rounded-full bg-brand-500/20 blur-[100px]" />
            <div className="absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-mint-500/10 blur-[110px]" />
            <div className="grid-lines absolute inset-0 opacity-[0.08]" />
          </div>

          <div className="relative mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(1.25rem+env(safe-area-inset-top))] sm:px-8">
            <header className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/[0.06]">
                  <Image src={site.logoWhite} alt="" width={26} height={26} priority />
                </span>
                <div>
                  <p className="text-[0.78rem] font-extrabold tracking-tight">Knight Medical Billing</p>
                  <p className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-white/45">Voice assistant</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!ended && (
                  <button type="button" onClick={onText} className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3 py-2 text-[0.68rem] font-bold text-white/75 transition-colors hover:bg-white/10 hover:text-white" aria-label="Open text chat">
                    <MessageCircle className="h-3.5 w-3.5" /> Text
                  </button>
                )}
                <button type="button" onClick={ended ? onClose : onEnd} className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-white/[0.06] text-white/70 transition-colors hover:bg-white/10 hover:text-white" aria-label="Close voice call">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </header>

            <div className="flex flex-1 flex-col items-center justify-center py-8 text-center sm:py-12">
              <div className="relative">
                <span aria-hidden className={`absolute inset-0 rounded-full bg-brand-400/20 blur-2xl ${active && !ended ? "animate-pulse" : ""}`} />
                <span className={`relative grid h-28 w-28 place-items-center overflow-hidden rounded-full border-2 border-white/20 bg-white/[0.06] shadow-[0_0_80px_-20px_rgba(124,215,242,0.55)] sm:h-36 sm:w-36 ${voiceState === "speaking" && !ended ? "voice-avatar-speaking" : ""}`}>
                  <Image src={site.logoWhite} alt={`${agentName} voice assistant`} width={82} height={82} priority className="h-[58%] w-[58%] object-contain" />
                </span>
                {active && !ended && (
                  <>
                    <span aria-hidden className="absolute inset-0 animate-ping rounded-full border border-brand-300/20" />
                    <span aria-hidden className="absolute -inset-3 rounded-full border border-white/[0.06]" />
                  </>
                )}
              </div>

              <p className="mt-7 text-[0.66rem] font-extrabold uppercase tracking-[0.22em] text-brand-200">{agentName} · Knight Medical Billing</p>
              <h1 className="mt-2 text-[clamp(2rem,6vw,3.3rem)] font-extrabold leading-[1.02] tracking-[-0.04em]">
                {ended ? "Thanks for calling." : voiceError ? "Let’s get you connected." : voiceState === "speaking" ? "Riley is speaking." : voiceState === "thinking" ? "One moment." : muted ? "You’re muted." : "You’re connected."}
              </h1>

              <div className="mt-5 flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 backdrop-blur-sm" aria-live="polite" aria-atomic="true">
                <span className={`h-1.5 w-1.5 rounded-full ${voiceError ? "bg-amber-300" : ended ? "bg-white/35" : voiceState === "speaking" ? "animate-pulse bg-mint-300" : "animate-pulse bg-brand-300"}`} />
                <span className="text-[0.74rem] font-extrabold">{status.label}</span>
              </div>
              <p className="mt-3 max-w-md text-[0.85rem] leading-relaxed text-white/60">{status.detail}</p>

              {!ended && !voiceError && (
                <div className="mt-7 flex h-16 items-center justify-center gap-1.5" aria-hidden="true">
                  {Array.from({ length: 25 }).map((_, index) => {
                    const speaking = voiceState === "speaking";
                    const listening = voiceState === "listening" || voiceState === "user-speaking";
                    const height = speaking ? 18 + ((index * 13) % 34) : listening ? 8 + ((index * 7) % 16) : 5;
                    return (
                      <span
                        key={index}
                        className={`w-1.5 rounded-full transition-all duration-300 ${speaking ? "bg-mint-300/80" : listening ? "bg-brand-300/70" : "bg-white/20"}`}
                        style={{
                          height: `${height}px`,
                          animation: speaking || listening ? `voice-bar 1.1s ease-in-out ${index * 55}ms infinite alternate` : undefined,
                        }}
                      />
                    );
                  })}
                </div>
              )}

              {welcome && !ended && !voiceError && voiceState !== "speaking" && (
                <p className="mt-3 max-w-lg text-[0.78rem] leading-relaxed text-white/40">{welcome}</p>
              )}

              {voiceError && (
                <div className="mt-6 w-full max-w-md rounded-2xl border border-amber-300/25 bg-amber-300/[0.08] p-4 text-left">
                  <p className="text-[0.78rem] font-extrabold text-amber-100">Voice connection needs attention</p>
                  <p className="mt-1.5 text-[0.76rem] leading-relaxed text-white/70">{voiceError}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={onRetry} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-[0.72rem] font-extrabold text-ink-950 hover:bg-brand-50">
                      <RefreshCw className="h-3.5 w-3.5" /> Try again
                    </button>
                    <button type="button" onClick={onText} className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3.5 py-2 text-[0.72rem] font-bold text-white/80 hover:bg-white/10">
                      <MessageCircle className="h-3.5 w-3.5" /> Use text instead
                    </button>
                  </div>
                </div>
              )}

              {ended && (
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  <button type="button" onClick={onRetry} className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-[0.78rem] font-extrabold text-ink-950 hover:bg-brand-50">
                    <RefreshCw className="h-4 w-4" /> Call again
                  </button>
                  <button type="button" onClick={onText} className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-4 py-2.5 text-[0.78rem] font-bold text-white/80 hover:bg-white/10">
                    <MessageCircle className="h-4 w-4" /> Text chat
                  </button>
                  <button type="button" onClick={onClose} className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-4 py-2.5 text-[0.78rem] font-bold text-white/70 hover:bg-white/10">
                    Close
                  </button>
                </div>
              )}
            </div>

            {!ended && (
              <div className="mx-auto mt-auto w-full max-w-lg">
                <div className="grid grid-cols-4 gap-3">
                  <button type="button" onClick={onMute} aria-pressed={muted} className="group flex flex-col items-center gap-2" aria-label={muted ? "Unmute microphone" : "Mute microphone"}>
                    <span className={`grid h-14 w-14 place-items-center rounded-full border transition-colors ${muted ? "border-amber-300/40 bg-amber-300/15 text-amber-200" : "border-white/15 bg-white/[0.07] text-white/80 group-hover:bg-white/10"}`}>
                      {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                    </span>
                    <span className="text-[0.62rem] font-bold text-white/55">{muted ? "Unmute" : "Mute"}</span>
                  </button>
                  <button type="button" onClick={onInterrupt} className="group flex flex-col items-center gap-2" aria-label="Interrupt Riley">
                    <span className="grid h-14 w-14 place-items-center rounded-full border border-white/15 bg-white/[0.07] text-white/80 transition-colors group-hover:bg-white/10 group-disabled:opacity-40">
                      <Square className="h-4 w-4" />
                    </span>
                    <span className="text-[0.62rem] font-bold text-white/55">Interrupt</span>
                  </button>
                  <button type="button" onClick={onText} className="group flex flex-col items-center gap-2" aria-label="Open text chat">
                    <span className="grid h-14 w-14 place-items-center rounded-full border border-white/15 bg-white/[0.07] text-white/80 transition-colors group-hover:bg-white/10">
                      <MessageCircle className="h-5 w-5" />
                    </span>
                    <span className="text-[0.62rem] font-bold text-white/55">Text</span>
                  </button>
                  <button ref={endRef} type="button" onClick={onEnd} className="group flex flex-col items-center gap-2" aria-label="End voice call">
                    <span className="grid h-14 w-14 place-items-center rounded-full bg-rose-500 text-white shadow-[0_12px_30px_-12px_rgba(244,63,94,0.7)] transition-colors hover:bg-rose-400">
                      <PhoneOff className="h-5 w-5" />
                    </span>
                    <span className="text-[0.62rem] font-bold text-white/55">End</span>
                  </button>
                </div>
                <div className="mt-5 flex items-center justify-center gap-4 text-[0.62rem] text-white/35">
                  <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3 w-3" /> HIPAA-conscious</span>
                  <span>No recordings stored by Knight</span>
                  {audioMode === "half-duplex" && <span className="inline-flex items-center gap-1.5"><ArrowLeft className="h-3 w-3 rotate-90" /> Limited echo cancellation · tap Interrupt to speak</span>}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
