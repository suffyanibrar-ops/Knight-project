import Image from "next/image";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, KeyRound, ShieldCheck } from "lucide-react";
import { ForgotPasswordForm } from "@/components/admin/password-reset-forms";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Admin Password Recovery",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default function ForgotPasswordPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-night px-4 py-12">
      <div className="absolute inset-0">
        <Image src="/images/about-team.jpg" alt="" fill className="object-cover opacity-40" sizes="100vw" priority />
        <div className="absolute inset-0 bg-gradient-to-br from-night via-ink-950/95 to-brand-900/70" />
      </div>
      <div className="dot-grid absolute inset-0 opacity-[0.15]" />
      <div className="relative w-full max-w-[26rem]">
        <Link href="/admin/login" className="mb-5 inline-flex items-center gap-1.5 text-[0.72rem] font-bold text-white/50 transition-colors hover:text-white">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
        </Link>
        <div className="overflow-hidden rounded-3xl border border-white/12 bg-white/[0.06] p-6 shadow-2xl backdrop-blur-xl sm:p-8">
          <div className="flex items-center gap-3">
            <Image src="/images/knight-mark-white.png" alt="Knight Medical Billing" width={44} height={44} className="h-11 w-11" />
            <div>
              <p className="text-[1.05rem] font-extrabold leading-none text-white">Knight Medical Billing</p>
              <p className="mt-1.5 text-[0.58rem] font-bold uppercase tracking-[0.24em] text-brand-300">Admin console</p>
            </div>
          </div>
          <div className="mt-6">
            <p className="flex items-center gap-1.5 text-[0.62rem] font-extrabold uppercase tracking-[0.18em] text-mint-300"><KeyRound className="h-3 w-3" /> Account recovery</p>
            <h1 className="mt-2 text-xl font-extrabold tracking-tight text-white">Reset your admin password</h1>
            <p className="mt-1.5 text-[0.8rem] leading-relaxed text-white/50">Enter the owner email configured for this console. A short-lived, single-use reset link will be sent to that inbox.</p>
          </div>
          <div className="mt-5"><ForgotPasswordForm /></div>
          <div className="mt-6 flex items-start gap-2 border-t border-white/10 pt-4">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mint-300" />
            <p className="text-[0.66rem] leading-relaxed text-white/40">For security, the response is the same whether or not the address matches the configured owner inbox. Reset links expire after 30 minutes.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
