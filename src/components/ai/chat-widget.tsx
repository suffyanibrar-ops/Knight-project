"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarCheck, Headphones, Loader2, Mic, MicOff, PhoneCall, Send, Square, UserRound, X } from "lucide-react";
import { Logo } from "@/components/logo";
import { cn } from "@/components/ui";
import { AppointmentModal, type BookedAppointment } from "./appointment-modal";
import { MarkdownLite } from "./markdown-lite";
import { useVoice } from "./use-voice";
import { trackConversion } from "@/lib/tracking";

interface AiConfig {
  enabled: boolean;
  agentName: string;
  welcome: string;
  voiceEnabled: boolean;
  voiceRate: number;
  voiceName: string;
  bookingEnabled: boolean;
  privacyNotice: string;
  knowledgeReady: boolean;
}

type Message = { id: string; role: "user" | "assistant" | "note"; text: string; pending?: boolean };

const QUICK_PROMPTS = [
  { label: "Improve A/R & collections", prompt: "We want to improve A/R and collections. Where should we start?" },
  { label: "Reduce denials", prompt: "We are seeing too many denials. What should we look at first?" },
  { label: "Billing & coding support", prompt: "We need help with billing and coding. What support fits our organization?" },
  { label: "Credentialing & enrollment", prompt: "We need help with credentialing or payer enrollment. What should we prepare?" },
  { label: "Not sure where to start", prompt: "I am not sure where the revenue-cycle problem is. Can you help me narrow it down?" },
];

const TOOL_LABELS: Record<string, string> = {
  search_website_knowledge: "Searching our website…",
  get_service_information: "Looking up service details…",
  save_lead_information: "Saving your details…",
  get_available_appointment_slots: "Checking real availability…",
  book_appointment: "Booking your call…",
  request_human_assistance: "Logging a human follow-up…",
};

/** Distinct voice-agent mark (not a generic chat/WhatsApp bubble). */
function VoiceAgentIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <rect x="4.1" y="9.1" width="1.9" height="5.8" rx="0.95" fill="currentColor" opacity="0.92" />
      <rect x="7.75" y="6.2" width="1.9" height="11.6" rx="0.95" fill="currentColor" />
      <rect x="11.4" y="7.8" width="1.9" height="8.4" rx="0.95" fill="currentColor" />
      <rect x="15.05" y="9.8" width="1.9" height="4.4" rx="0.95" fill="currentColor" opacity="0.92" />
      <circle cx="18.85" cy="5.15" r="1.15" fill="#7ee0c1" />
    </svg>
  );
}

function uid(): string {
  return Math.random().toString(36).slice(2);
}

export function AiChatWidget() {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [toolStatus, setToolStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [voiceIntro, setVoiceIntro] = useState(false);
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [handoff, setHandoff] = useState({ name: "", email: "", phone: "", reason: "" });
  const [handoffSending, setHandoffSending] = useState(false);
  const [voiceOptions, setVoiceOptions] = useState<{ name: string; lang: string }[]>([]);
  const [voiceChoice, setVoiceChoice] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const voiceModeRef = useRef(false);
  const speechBufferRef = useRef("");
  const speechStartedRef = useRef(false);
  const leadTrackedRef = useRef(false);
  const bargeRef = useRef(false);
  const sendRef = useRef<(text: string, fromVoice?: boolean) => void>(() => undefined);
  const bargeHandlerRef = useRef<() => void>(() => undefined);
  const speakRef = useRef<(text: string) => void>(() => undefined);
  const messagesRef = useRef<Message[]>([]);

  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const voice = useVoice({
    onFinalUtterance: (text) => { bargeRef.current = false; sendRef.current(text, true); },
    onBargeIn: () => bargeHandlerRef.current(),
    rate: config?.voiceRate,
    voiceName: voiceChoice || config?.voiceName,
  });
  useEffect(() => { speakRef.current = voice.speak; }, [voice.speak]);

  // Load public config when the widget first opens.
  useEffect(() => {
    if (!open || config || configError) return;
    fetch("/api/ai/config", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("The assistant is unavailable right now.");
        return (await response.json()) as AiConfig;
      })
      .then((data) => {
        setConfig(data);
        setMessages([{ id: uid(), role: "assistant", text: data.welcome }]);
      })
      .catch((failure: Error) => setConfigError(failure.message));
  }, [open, config, configError]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, toolStatus, open]);

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  /**
   * Batch streamed sentences before speaking.
   *
   * Speaking each sentence as its own utterance was the source of the unnatural
   * gaps: Web Speech inserts noticeable silence between utterances, and the next
   * sentence often arrived mid-gap. We now wait for two completed sentences (or
   * the end of the answer) and send them as one naturally paced utterance.
   */
  const flushSpeech = useCallback((force: boolean) => {
    if (!voiceModeRef.current) return;
    const buffer = speechBufferRef.current;

    // The answer is finished: speak everything not yet spoken as one natural
    // utterance. If nothing was spoken yet, this is the whole answer (no gaps at
    // all). If an opening batch is playing, this simply queues the rest.
    if (force) {
      speechBufferRef.current = "";
      const combined = buffer.replace(/\s+/g, " ").trim();
      if (combined) speakRef.current(combined);
      return;
    }

    // Once the opening batch is speaking, hold the remainder so a normal answer
    // crosses only one utterance boundary at the end. Very long answers (>700
    // chars waiting) are released early so audio never runs dry.
    if (speechStartedRef.current) {
      if (buffer.length < 700) return;
      speechBufferRef.current = "";
      speakRef.current(buffer.replace(/\s+/g, " ").trim());
      return;
    }

    // Opening: wait for two completed sentences (or one substantial sentence)
    // to give the voice a natural phrase to start with.
    const sentences: string[] = [];
    const pattern = /[^.!?]+[.!?]+(?=\s|$)/g;
    let match: RegExpExecArray | null;
    let lastIndex = 0;
    while ((match = pattern.exec(buffer)) !== null) {
      sentences.push(match[0]);
      lastIndex = pattern.lastIndex;
    }
    const remainder = buffer.slice(lastIndex);
    const combined = sentences.join(" ").replace(/\s+/g, " ").trim();
    if (!combined) return;
    if (sentences.length < 2 && combined.length < 220) return;
    speechBufferRef.current = remainder;
    speechStartedRef.current = true;
    speakRef.current(combined);
  }, []);

  const stopEverything = useCallback(() => {
    requestIdRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
    setToolStatus(null);
    speechBufferRef.current = "";
    speechStartedRef.current = false;
    voice.interrupt();
  }, [voice]);

  bargeHandlerRef.current = () => {
    if (bargeRef.current) return;
    bargeRef.current = true;
    // Invalidate every callback from the interrupted answer before aborting it.
    requestIdRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
    setToolStatus(null);
    speechBufferRef.current = "";
    speechStartedRef.current = false;
    voice.interrupt();
    setMessages((prev) => prev.map((message) => (message.pending ? { ...message, pending: false } : message)));
  };

  const send = useCallback(async (raw: string, fromVoice = false) => {
    const text = raw.trim().slice(0, 2000);
    if (!text) return;
    if (busy) {
      if (!fromVoice) return;
      stopEverything();
    }
    bargeRef.current = false;
    setError(null);
    setInput("");
    if (voiceModeRef.current && voice.state === "speaking") {
      // A new typed turn supersedes any audio still finishing from the old one.
      speechBufferRef.current = "";
      speechStartedRef.current = false;
      voice.interrupt();
    }
    // Every request owns a generation. Aborts/barge-ins invalidate it so a
    // delayed token, [DONE] event, or finally block cannot revive an old turn.
    const requestId = ++requestIdRef.current;
    const isCurrent = () => requestId === requestIdRef.current;
    setMessages((prev) => [...prev, { id: uid(), role: "user", text }]);
    const assistantId = uid();
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", text: "", pending: true }]);
    setBusy(true);
    setToolStatus(null);
    speechBufferRef.current = "";
    speechStartedRef.current = false;
    if (voice.state !== "off" && voice.state !== "unsupported") voice.setThinking();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, channel: voiceModeRef.current ? "voice" : "text" }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "The assistant is unavailable. Please try again.");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const appendToken = (token: string) => {
        if (!isCurrent()) return;
        setMessages((prev) => prev.map((message) => (message.id === assistantId ? { ...message, text: message.text + token } : message)));
        if (voiceModeRef.current) {
          speechBufferRef.current += token;
          flushSpeech(false);
        }
      };
      const handleEvent = (payload: string) => {
        if (!isCurrent()) return;
        if (!payload || payload === "[DONE]") return;
        let event: Record<string, unknown>;
        try { event = JSON.parse(payload) as Record<string, unknown>; } catch { return; }
        switch (event.type) {
          case "token":
            if (typeof event.text === "string") appendToken(event.text);
            break;
          case "tool_start":
            setToolStatus(TOOL_LABELS[String(event.name)] ?? "Working on it…");
            break;
          case "tool_done":
            setToolStatus(null);
            break;
          case "error":
            setError(typeof event.message === "string" ? event.message : "The assistant had a problem. Please try again.");
            break;
          case "done":
            setToolStatus(null);
            if (event.leadId && !leadTrackedRef.current) {
              leadTrackedRef.current = true;
              trackConversion("ai_lead", { surface: "chat" });
            }
            break;
          default:
            break;
        }
      };
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";
        for (const chunk of chunks) {
          const line = chunk.split("\n").find((part) => part.startsWith("data:"));
          if (line) handleEvent(line.slice(5).trim());
        }
      }
      if (buffer.includes("data:")) {
        const line = buffer.split("\n").find((part) => part.startsWith("data:"));
        if (line) handleEvent(line.slice(5).trim());
      }
    } catch (failure) {
      if ((failure as Error)?.name === "AbortError") {
        // Intentional stop/interruption. The barge/stop handler already cleared
        // the voice buffer and invalidated this request.
      } else if (!isCurrent()) {
        // A newer turn has already replaced this one.
      } else {
        const message = failure instanceof Error ? failure.message : "The assistant is unavailable.";
        setError(message);
        // Never speak a partial answer after a failed response.
        speechBufferRef.current = "";
        speechStartedRef.current = false;
        if (voiceModeRef.current) voice.interrupt();
        setMessages((prev) => prev.map((item) => (item.id === assistantId && !item.text ? { ...item, text: "I'm sorry — I couldn't respond just now. You can try again, use the contact form, or ask me to arrange a human follow-up." } : item)));
      }
    } finally {
      if (!isCurrent()) return;
      abortRef.current = null;
      setBusy(false);
      setMessages((prev) => prev.map((message) => (message.id === assistantId ? { ...message, pending: false } : message)));
      if (voiceModeRef.current) {
        flushSpeech(true);
        voice.settle();
      }
    }
  }, [busy, flushSpeech, stopEverything, voice]);
  sendRef.current = send;

  function loadVoiceOptions() {
    setVoiceOptions(voice.getVoices().map((item) => ({ name: item.name, lang: item.lang })));
    try { setVoiceChoice(window.localStorage.getItem("kmb-voice-choice") ?? ""); } catch { /* storage blocked */ }
  }

  function chooseVoice(name: string) {
    setVoiceChoice(name);
    try { window.localStorage.setItem("kmb-voice-choice", name); } catch { /* storage blocked */ }
  }

  function handleVoiceButton() {
    if (!config?.voiceEnabled) return;
    if (!voice.supported) {
      setError("Voice isn't supported in this browser. Please use Chrome, Edge or Safari, or keep chatting by text.");
      return;
    }
    loadVoiceOptions();
    if (voice.state === "off") setVoiceIntro(true);
    else setVoiceIntro(false);
  }

  async function enableVoice() {
    setVoiceIntro(false);
    voiceModeRef.current = true;
    await voice.start();
    if (!voiceModeRef.current) return;
    setMessages((prev) => [...prev, { id: uid(), role: "note", text: "Voice mode is on. Speak naturally — I'll stop talking as soon as you interrupt." }]);
  }

  function endVoice() {
    voice.end();
    voiceModeRef.current = false;
    setMessages((prev) => [...prev, { id: uid(), role: "note", text: "Voice mode ended. You can keep typing." }]);
  }

  function onBooked(appointment: BookedAppointment) {
    setMessages((prev) => [...prev, { id: uid(), role: "assistant", text: `You're booked for **${appointment.dateLabel} at ${appointment.timeLabel}** (${appointment.timezoneLabel ?? appointment.timezone}). A confirmation email with reschedule and cancel options has been sent.` }]);
    // Leave the modal open so the visitor sees the explicit success state.
    // The Done button closes it.
  }

  async function submitHandoff(event: React.FormEvent) {
    event.preventDefault();
    if (messagesRef.current.length === 0) {
      setError("Send me a message first, then I can pass your request to the team.");
      return;
    }
    setHandoffSending(true);
    setError(null);
    try {
      const response = await fetch("/api/ai/handoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: handoff.reason || "Visitor requested a human representative from the chat widget.",
          name: handoff.name || undefined,
          email: handoff.email || undefined,
          phone: handoff.phone || undefined,
        }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Could not log the request.");
      setHandoffOpen(false);
      setHandoff({ name: "", email: "", phone: "", reason: "" });
      trackConversion("ai_handoff", { surface: "chat" });
      setMessages((prev) => [...prev, { id: uid(), role: "note", text: "Request logged for the Knight Medical Billing team. A human will follow up during business hours — I can't confirm that someone is online right now." }]);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not log the request.");
    } finally {
      setHandoffSending(false);
    }
  }

  const voiceActive = voice.state !== "off" && voice.state !== "unsupported";
  const voiceStatus = voice.state === "listening"
    ? "Listening…"
    : voice.state === "user-speaking"
      ? "Listening to you…"
      : voice.state === "thinking"
        ? "Thinking…"
        : voice.state === "speaking"
          ? voice.audioMode === "half-duplex" ? "Speaking — tap Stop to interrupt" : "Speaking — interrupt me any time"
          : voice.state === "interrupted"
            ? "Interrupted — listening…"
            : voice.state === "error"
              ? "Voice error"
              : "";

  return (
    <>
      <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.96 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              role="dialog"
              aria-label={`Chat with ${config?.agentName ?? "the Knight Medical Billing assistant"}`}
              data-voice-state={voice.state}
              data-voice-mode={voice.audioMode}
              className="flex max-h-[min(82vh,40rem)] w-[min(94vw,24.5rem)] flex-col overflow-hidden rounded-3xl border border-mist-200 bg-surface shadow-[0_40px_80px_-30px_rgba(4,20,31,0.45)]"
            >
              <div className="relative bg-night-soft px-4 py-4 text-white">
                <div className="dot-grid absolute inset-0 opacity-20" />
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Logo variant="light" markSize={30} />
                    <div>
                      <p className="text-[0.74rem] font-extrabold leading-tight">{config?.agentName ?? "Knight Assistant"}</p>
                      <p className="text-[0.62rem] font-semibold text-white/60">AI assistant · Knight Medical Billing</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => setOpen(false)} aria-label="Close chat" className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white/80 hover:bg-white/20">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <p className="relative mt-2.5 flex items-center gap-1.5 text-[0.65rem] font-semibold text-white/60">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-pulse-ring absolute inline-flex h-full w-full rounded-full bg-mint-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-mint-400" />
                  </span>
                  Answers from our website · voice available
                </p>
              </div>

              <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-mist-50 p-4">
                {configError && (
                  <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[0.76rem] font-semibold text-amber-900">
                    {configError} You can still use the contact form or call (812) 994-0046.
                  </p>
                )}
                {messages.map((message) =>
                  message.role === "note" ? (
                    <p key={message.id} className="mx-auto max-w-[90%] rounded-full bg-white px-3 py-1.5 text-center text-[0.64rem] font-semibold text-ink-600/80 shadow-sm">
                      {message.text}
                    </p>
                  ) : (
                    <div key={message.id} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
                      <div className={cn("max-w-[86%] rounded-2xl px-3.5 py-2.5 text-[0.8rem] leading-relaxed", message.role === "user" ? "rounded-br-md bg-brand-500 text-white" : "rounded-bl-md border border-mist-200 bg-surface text-ink-800")}>
                        {message.role === "user" ? <p className="whitespace-pre-line">{message.text}</p> : <MarkdownLite text={message.text} />}
                        {message.pending && !message.text && (
                          <span className="flex items-center gap-1.5 text-[0.68rem] font-semibold text-ink-600/70"><Loader2 className="h-3 w-3 animate-spin" /> Thinking…</span>
                        )}
                        {message.pending && message.text && <span className="mt-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-brand-400" aria-hidden />}
                      </div>
                    </div>
                  ),
                )}
                {toolStatus && (
                  <p className="flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-[0.66rem] font-bold text-brand-700"><Loader2 className="h-3 w-3 animate-spin" /> {toolStatus}</p>
                )}
                {voiceActive && voiceStatus && (
                  <p className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.66rem] font-bold", voice.state === "error" ? "bg-rose-50 text-rose-700" : "bg-night-soft text-white")}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", voice.state === "speaking" ? "animate-pulse bg-mint-400" : voice.state === "listening" || voice.state === "user-speaking" ? "bg-brand-300" : "bg-amber-300")} />
                    {voiceStatus}
                  </p>
                )}
                {voiceActive && voice.audioMode === "half-duplex" && (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[0.68rem] leading-relaxed text-amber-900">
                    This device reports limited echo cancellation. Riley uses a safer half-duplex mode here — tap <strong>Stop</strong> to interrupt and speak.
                  </p>
                )}
                {voice.error && (
                  <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[0.72rem] font-semibold text-rose-700">
                    {voice.error}
                  </p>
                )}
                {error && (
                  <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[0.74rem] font-semibold text-rose-700">
                    {error}{" "}
                    <button type="button" onClick={() => setHandoffOpen(true)} className="underline">Ask for a person</button>
                  </p>
                )}
                {voiceIntro && (
                  <div className="rounded-2xl border border-brand-200 bg-brand-50 p-3 text-[0.74rem] leading-relaxed text-brand-900">
                    <p className="font-extrabold">Enable voice conversation</p>
                    <p className="mt-1">Voice uses your microphone to hear you and your speaker to answer. Audio is processed in your browser and is <strong>not recorded or stored</strong>. Microphone permission is requested only after you continue.</p>
                    {voiceOptions.length > 1 && (
                      <label className="mt-2.5 block text-[0.66rem] font-bold text-brand-900">
                        Voice
                        <select
                          value={voiceChoice}
                          onChange={(event) => chooseVoice(event.target.value)}
                          className="mt-1 w-full rounded-lg border border-brand-200 bg-white px-2.5 py-1.5 text-[0.72rem] font-semibold text-ink-800 outline-none focus:border-brand-400"
                          aria-label="Choose a free browser voice"
                        >
                          <option value="">Auto — best natural voice</option>
                          {voiceOptions.slice(0, 20).map((item) => (
                            <option key={`${item.name}-${item.lang}`} value={item.name}>{item.name} ({item.lang})</option>
                          ))}
                        </select>
                      </label>
                    )}
                    {voiceOptions.length > 0 && (
                      <p className="mt-1.5 text-[0.6rem] leading-relaxed text-brand-900/60">
                        Free voices come from your browser and device. Enhanced or Neural voices usually sound the most natural.
                      </p>
                    )}
                    <div className="mt-2 flex gap-2">
                      <button type="button" onClick={() => void enableVoice()} className="btn btn-primary px-3 py-2 text-[0.72rem]"><Mic className="h-3.5 w-3.5" /> Enable microphone</button>
                      <button type="button" onClick={() => setVoiceIntro(false)} className="btn btn-light px-3 py-2 text-[0.72rem]">Not now</button>
                    </div>
                  </div>
                )}
                {messages.length <= 1 && config?.knowledgeReady !== false && (
                  <div className="grid gap-1.5 pt-1">
                    {QUICK_PROMPTS.map((prompt) => (
                      <button key={prompt.label} type="button" onClick={() => void send(prompt.prompt)} className="rounded-xl border border-brand-100 bg-surface px-3 py-2 text-left text-[0.76rem] font-semibold text-brand-700 transition-colors hover:border-brand-300 hover:bg-brand-50">
                        {prompt.label}
                      </button>
                    ))}
                  </div>
                )}
                {handoffOpen && (
                  <form onSubmit={submitHandoff} className="space-y-2 rounded-2xl border border-mist-200 bg-surface p-3">
                    <p className="text-[0.72rem] font-extrabold text-ink-950">Request a human follow-up</p>
                    <p className="text-[0.66rem] text-ink-600/80">The team will reply during business hours. This does not start a live agent session.</p>
                    <input value={handoff.name} onChange={(event) => setHandoff({ ...handoff, name: event.target.value })} placeholder="Your name" aria-label="Your name" className="w-full rounded-lg border border-mist-200 bg-mist-50 px-2.5 py-1.5 text-[0.74rem] outline-none focus:border-brand-400" />
                    <input value={handoff.email} onChange={(event) => setHandoff({ ...handoff, email: event.target.value })} type="email" placeholder="Business email" aria-label="Business email" className="w-full rounded-lg border border-mist-200 bg-mist-50 px-2.5 py-1.5 text-[0.74rem] outline-none focus:border-brand-400" />
                    <input value={handoff.phone} onChange={(event) => setHandoff({ ...handoff, phone: event.target.value })} placeholder="Phone (optional)" aria-label="Phone" className="w-full rounded-lg border border-mist-200 bg-mist-50 px-2.5 py-1.5 text-[0.74rem] outline-none focus:border-brand-400" />
                    <textarea value={handoff.reason} onChange={(event) => setHandoff({ ...handoff, reason: event.target.value })} placeholder="What do you need help with?" aria-label="Reason" rows={2} className="w-full rounded-lg border border-mist-200 bg-mist-50 px-2.5 py-1.5 text-[0.74rem] outline-none focus:border-brand-400" />
                    <div className="flex gap-2">
                      <button type="submit" disabled={handoffSending} className="btn btn-primary px-3 py-1.5 text-[0.72rem]">{handoffSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserRound className="h-3.5 w-3.5" />} Send request</button>
                      <button type="button" onClick={() => setHandoffOpen(false)} className="btn btn-light px-3 py-1.5 text-[0.72rem]">Cancel</button>
                    </div>
                  </form>
                )}
              </div>

              <div className="border-t border-mist-200 bg-surface p-3">
                {config?.privacyNotice && <p className="mb-2 rounded-lg bg-mist-50 px-2.5 py-1.5 text-[0.6rem] leading-relaxed text-ink-600/80">{config.privacyNotice}</p>}
                <form
                  onSubmit={(event) => { event.preventDefault(); void send(input); }}
                  className="flex items-center gap-2"
                >
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder={voiceActive ? "Speak or type…" : "Ask a question…"}
                    aria-label="Chat message"
                    maxLength={2000}
                    className="min-w-0 flex-1 rounded-full border border-mist-200 bg-mist-50 px-3.5 py-2.5 text-[0.8rem] outline-none focus:border-brand-400"
                  />
                  {config?.voiceEnabled && (
                    <button type="button" onClick={handleVoiceButton} aria-label={voiceActive ? "Voice controls" : "Start voice conversation"} aria-pressed={voiceActive} className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full border transition-colors", voiceActive ? "border-brand-500 bg-brand-50 text-brand-700" : "border-mist-200 bg-surface text-ink-700 hover:border-brand-300")}>
                      {voiceActive ? <Headphones className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </button>
                  )}
                  {busy || voiceActive ? (
                    <button type="button" onClick={stopEverything} aria-label="Stop speaking and cancel the current answer" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-night-soft text-white hover:bg-brand-600"><Square className="h-3.5 w-3.5" /></button>
                  ) : null}
                  <button type="submit" aria-label="Send message" disabled={!input.trim() || busy} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-night-soft text-white transition-colors hover:bg-brand-600 disabled:opacity-40"><Send className="h-3.5 w-3.5" /></button>
                </form>
                {voiceActive && (
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <button type="button" onClick={voice.toggleMute} className="flex items-center gap-1.5 rounded-full border border-mist-200 px-2.5 py-1 text-[0.66rem] font-bold text-ink-700 hover:border-brand-300">
                      {voice.muted ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />} {voice.muted ? "Unmute" : "Mute"}
                    </button>
                    <button type="button" onClick={() => { stopEverything(); setVoiceIntro(false); setHandoffOpen(false); }} className="rounded-full border border-mist-200 px-2.5 py-1 text-[0.66rem] font-bold text-ink-700 hover:border-brand-300"><PhoneCall className="mr-1 inline h-3 w-3" />Stop</button>
                    <button type="button" onClick={endVoice} className="rounded-full border border-rose-200 px-2.5 py-1 text-[0.66rem] font-bold text-rose-700 hover:bg-rose-50">End voice</button>
                  </div>
                )}
                <div className="mt-2 flex items-center justify-between gap-2">
                  <button type="button" onClick={() => setBookingOpen(true)} disabled={!config?.bookingEnabled} className="flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-[0.68rem] font-bold text-brand-700 transition-colors hover:bg-brand-100 disabled:opacity-40">
                    <CalendarCheck className="h-3.5 w-3.5" /> Book a 15-min call
                  </button>
                  <button type="button" onClick={() => { setHandoffOpen(true); setError(null); }} className="flex items-center gap-1.5 rounded-full border border-mist-200 px-3 py-1.5 text-[0.68rem] font-bold text-ink-700 transition-colors hover:border-brand-300">
                    <UserRound className="h-3.5 w-3.5" /> Talk to a person
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? "Close AI assistant" : "Open Knight AI assistant"}
          aria-expanded={open}
          className="group relative grid h-14 w-14 place-items-center rounded-full border border-white/10 bg-[linear-gradient(145deg,#0d3346_0%,#04141f_100%)] text-white shadow-[0_20px_40px_-15px_rgba(4,20,31,0.7)] transition-colors hover:border-brand-300/40 hover:bg-[linear-gradient(145deg,#0f6988_0%,#071f2f_100%)]"
        >
          {!open && <span className="animate-pulse-ring absolute inset-0 rounded-full bg-brand-400/40" />}
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={open ? "close" : "open"} initial={{ opacity: 0, rotate: -30, scale: 0.7 }} animate={{ opacity: 1, rotate: 0, scale: 1 }} exit={{ opacity: 0, rotate: 30, scale: 0.7 }} transition={{ duration: 0.18 }} className="relative">
              {open ? <X className="h-5 w-5" /> : <VoiceAgentIcon className="h-7 w-7" />}
            </motion.span>
          </AnimatePresence>
          {!open && (
            <span aria-hidden className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full border border-night-soft bg-mint-400 px-1 text-[0.42rem] font-extrabold uppercase leading-none tracking-[0.02em] text-night-soft">
              AI
            </span>
          )}
        </button>
      </div>

      {bookingOpen && <AppointmentModal onClose={() => setBookingOpen(false)} onBooked={onBooked} />}
    </>
  );
}
