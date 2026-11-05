"use client";

import { motion } from "framer-motion";
import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { Typewriter } from "./motion/typewriter";
import { HeroCanvas } from "./motion/hero-canvas";
import { HeroPanel } from "./hero-panel";
import { site } from "@/lib/site";
import { Icon } from "./icon";
import { Magnetic } from "./motion/magnetic";

const typePhrases = ["managed end to end.", "protected from denials.", "reported clearly.", "audit ready."];

const promises = [
  { title: "5 Days Process", detail: "Fast & easy", icon: "Zap" },
  { title: "No Prepayment", detail: "No hidden fees", icon: "Wallet" },
  { title: "24/5 Support", detail: "Multilingual", icon: "Headphones" },
  { title: "99.9%", detail: "Claim acceptance", icon: "BadgeCheck" },
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (index: number) => ({ opacity: 1, y: 0, transition: { duration: 0.7, delay: 0.08 * index, ease: [0.22, 1, 0.36, 1] as const } }),
};

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-mist-50 via-white to-white">
      <div className="pointer-events-none absolute inset-0">
        <HeroCanvas />
        <div className="grid-lines absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_at_top,black,transparent_75%)]" />
        <div aria-hidden className="animated-gradient absolute -right-32 -top-24 h-[34rem] w-[34rem] rounded-full opacity-25 blur-[100px]" />
        <div className="absolute -left-32 top-40 h-80 w-80 rounded-full bg-mint-100/70 blur-[90px]" />
      </div>

      <div data-hero-reveal className="shell relative grid items-center gap-12 pb-14 pt-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10 lg:pb-20 lg:pt-16">
        <div>
          <motion.div initial="hidden" animate="show" custom={0} variants={fadeUp} className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/80 px-3 py-1.5 text-[0.7rem] font-extrabold uppercase tracking-[0.16em] text-brand-700 shadow-sm">
              <Sparkles className="h-3.5 w-3.5" /> Custom tailored billing
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-mist-200 bg-white/70 px-3 py-1.5 text-[0.7rem] font-bold text-ink-700">
              <ShieldCheck className="h-3.5 w-3.5 text-mint-600" /> HIPAA compliant
            </span>
          </motion.div>

          <motion.h1 initial="hidden" animate="show" custom={1} variants={fadeUp} className="mt-5 text-[clamp(2.15rem,5.6vw,4.1rem)] font-extrabold leading-[1.04] tracking-[-0.04em] text-ink-950">
            Your revenue cycle,
            <span className="relative mt-1 flex items-baseline gap-3">
              <span className="relative inline-block align-bottom text-brand-600">
                <Typewriter phrases={typePhrases} className="display-serif" />
              </span>
            </span>
            <svg aria-hidden viewBox="0 0 320 12" className="mt-1 h-2.5 w-[min(18rem,72%)] text-brand-400" fill="none" preserveAspectRatio="none">
              <motion.path
                d="M2 9C60 3.5 150 2 318 6.5"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 1.1, delay: 0.9, ease: [0.22, 1, 0.36, 1] }}
              />
            </svg>
          </motion.h1>

          <motion.p initial="hidden" animate="show" custom={2} variants={fadeUp} className="mt-6 max-w-xl text-[1rem] leading-relaxed text-ink-600/85 sm:text-[1.06rem]">
            Knight Medical Billing is a US medical billing and revenue cycle management partner for independent practices, clinics and specialty groups. From eligibility checks to final payment posting, we run the administrative side of your revenue — in your existing software, with your own dedicated team.
          </motion.p>

          <motion.div initial="hidden" animate="show" custom={3} variants={fadeUp} className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Magnetic strength={7}>
              <Link href="/schedule-form" className="btn btn-primary group px-6 py-4 text-[0.95rem]">
                Request a consultation
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" strokeWidth={2.4} />
              </Link>
            </Magnetic>
            <Magnetic strength={5}>
              <Link href="/services" className="btn btn-light group px-6 py-4 text-[0.95rem]">
                Explore our services
                <ArrowRight className="h-4 w-4 text-brand-600 transition-transform group-hover:translate-x-1" strokeWidth={2.2} />
              </Link>
            </Magnetic>
          </motion.div>

          <motion.div initial="hidden" animate="show" custom={5} variants={fadeUp} className="mt-8 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {promises.map((promise) => (
              <div key={promise.title} className="rounded-2xl border border-mist-200 bg-white/80 p-3 backdrop-blur transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-sm">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand-50 text-brand-700">
                  <Icon name={promise.icon} className="h-4 w-4" />
                </span>
                <p className="mt-2 text-[0.78rem] font-extrabold leading-tight text-ink-950">{promise.title}</p>
                <p className="mt-0.5 text-[0.62rem] font-semibold text-ink-600/80">{promise.detail}</p>
              </div>
            ))}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto w-full max-w-[30rem] lg:max-w-none"
        >
          <div aria-hidden className="absolute -inset-3 -z-10 rounded-[2.2rem] bg-gradient-to-tr from-brand-100/70 via-surface/40 to-mint-100/70" />
          <HeroPanel />
        </motion.div>
      </div>

      {/* Revenue-flow rail: the intro's hairline lands here and becomes part of the hero. */}
      <div className="shell relative pb-8 sm:pb-10">
        <div data-hero-flow-line className="hero-flow" aria-hidden="true">
          <span className="hero-flow__track" />
          {["Claims", "Processing", "A/R", "Payments"].map((label, index) => (
            <span key={label} className="hero-flow__node" style={{ left: `${(index / 3) * 100}%` }}>
              <span className={`hero-flow__dot ${index >= 2 ? "hero-flow__dot--mint" : ""}`} />
              <span className="hero-flow__label">{label}</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
