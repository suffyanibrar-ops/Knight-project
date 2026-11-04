"use client";

import { AnimatePresence, motion, useScroll, useSpring } from "framer-motion";
import { ArrowUp, CalendarCheck, MessageCircle, Send, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { site } from "@/lib/site";
import { Logo } from "./logo";
import { cn } from "./ui";

export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 26, restDelta: 0.001 });
  return <motion.div style={{ scaleX }} className="fixed inset-x-0 top-0 z-[70] h-[3px] origin-left bg-gradient-to-r from-brand-500 via-brand-300 to-mint-500" />;
}

export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setVisible(window.scrollY > 700);
    };
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    update(); // honour a restored scroll position on reload
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Back to top"
          className="fixed bottom-[6.4rem] right-5 z-40 grid h-11 w-11 place-items-center rounded-full border border-mist-200 bg-surface text-ink-900 shadow-lg transition-colors hover:border-brand-300 hover:text-brand-700 sm:right-6"
        >
          <ArrowUp className="h-4 w-4" strokeWidth={2.4} />
        </motion.button>
      )}
    </AnimatePresence>
  );
}

type Message = { from: "bot" | "user"; text: string };

const quickReplies = [
  { label: "What does it cost?", answer: "We start with a free consultation and there is no prepayment or hidden fees. Pricing depends on your facility, specialty and volume — call (812) 994-0046 and we will walk you through it." },
  { label: "How fast can we start?", answer: "Our onboarding is a fast, easy 5-day process: consultation, a dedicated team assigned to your facility, clean-up and stabilization, then ongoing RCM." },
  { label: "Schedule a consultation", answer: "Great. We will review your billing workflow, claim acceptance and outstanding A/R together, then show you how a dedicated Knight team would take over. Use the link below to request a time." },
  { label: "Is my data safe?", answer: "Yes. We are HIPAA compliant with complete data and document security, secure data flow and strict quality control policies. PHI is handled only through compliant channels." },
];

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { from: "bot", text: "Hi — welcome to Knight Medical Billing. Ask about our services, onboarding or specialities, or I can help you reach our team." },
  ]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const lower = trimmed.toLowerCase();
    let reply =
      "Thanks — a billing strategist will follow up within one business hour. For an immediate answer, call " +
      site.phone +
      ". In the meantime, you can book a free revenue audit and we'll bring the numbers.";
    const match = quickReplies.find((item) => lower.includes(item.label.toLowerCase().replace(/[?.]/g, "")) || lower.includes(item.label.toLowerCase().split(" ")[1] ?? ""));
    if (lower.includes("cost") || lower.includes("price") || lower.includes("fee")) reply = quickReplies[0].answer;
    else if (lower.includes("fast") || lower.includes("start") || lower.includes("onboard") || lower.includes("live")) reply = quickReplies[1].answer;
    else if (lower.includes("audit") || lower.includes("demo") || lower.includes("book")) reply = quickReplies[2].answer;
    else if (lower.includes("hipaa") || lower.includes("safe") || lower.includes("security") || lower.includes("data")) reply = quickReplies[3].answer;
    else if (match) reply = match.answer;
    setMessages((prev) => [...prev, { from: "user", text: trimmed }, { from: "bot", text: reply }]);
    setInput("");
  }

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
              className="flex max-h-[min(78vh,34rem)] w-[min(92vw,23rem)] flex-col overflow-hidden rounded-3xl border border-mist-200 bg-surface shadow-[0_40px_80px_-30px_rgba(4,20,31,0.45)]"
            >
              <div className="relative bg-night-soft px-4 py-4 text-white">
                <div className="dot-grid absolute inset-0 opacity-20" />
                <div className="relative flex items-center justify-between">
                  <Logo variant="light" markSize={32} />
                  <button type="button" onClick={() => setOpen(false)} aria-label="Close chat" className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white/80 hover:bg-white/20">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <p className="relative mt-3 flex items-center gap-1.5 text-[0.7rem] font-semibold text-white/70">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-pulse-ring absolute inline-flex h-full w-full rounded-full bg-mint-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-mint-400" />
                  </span>
                  Online · avg. reply under 1 hour
                </p>
              </div>
              <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-mist-50 p-4">
                {messages.map((message, index) => (
                  <div key={index} className={cn("flex", message.from === "user" ? "justify-end" : "justify-start")}>
                    <p
                      className={cn(
                        "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[0.8rem] leading-relaxed",
                        message.from === "user" ? "rounded-br-md bg-brand-500 text-white" : "rounded-bl-md border border-mist-200 bg-surface text-ink-800",
                      )}
                    >
                      {message.text}
                    </p>
                  </div>
                ))}
                {messages.length <= 1 && (
                  <div className="grid gap-1.5 pt-1">
                    {quickReplies.map((reply) => (
                      <button
                        key={reply.label}
                        type="button"
                        onClick={() => send(reply.label)}
                        className="rounded-xl border border-brand-100 bg-surface px-3 py-2 text-left text-[0.76rem] font-semibold text-brand-700 transition-colors hover:border-brand-300 hover:bg-brand-50"
                      >
                        {reply.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="border-t border-mist-200 bg-surface p-3">
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    send(input);
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder="Ask a question…"
                    aria-label="Chat message"
                    className="min-w-0 flex-1 rounded-full border border-mist-200 bg-mist-50 px-3.5 py-2.5 text-[0.8rem] outline-none focus:border-brand-400"
                  />
                  <button type="submit" aria-label="Send message" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-night-soft text-white transition-colors hover:bg-brand-600">
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </form>
                <Link href="/schedule-form" className="mt-2 flex items-center justify-center gap-1.5 rounded-full bg-brand-50 py-2 text-[0.72rem] font-bold text-brand-700 transition-colors hover:bg-brand-100">
                  <CalendarCheck className="h-3.5 w-3.5" /> Book my free audit
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? "Close chat" : "Open chat"}
          aria-expanded={open}
          className="group relative grid h-14 w-14 place-items-center rounded-full bg-night-soft text-white shadow-[0_20px_40px_-15px_rgba(4,20,31,0.7)] transition-colors hover:bg-brand-600"
        >
          {!open && <span className="animate-pulse-ring absolute inset-0 rounded-full bg-brand-400/40" />}
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={open ? "close" : "open"}
              initial={{ opacity: 0, rotate: -30, scale: 0.7 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={{ opacity: 0, rotate: 30, scale: 0.7 }}
              transition={{ duration: 0.18 }}
              className="relative"
            >
              {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-6 w-6" />}
            </motion.span>
          </AnimatePresence>
        </button>
      </div>
      <BackToTop />
    </>
  );
}
