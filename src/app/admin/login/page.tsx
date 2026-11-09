import Image from "next/image";
import type { Metadata } from "next";
import { ArrowLeft, Lock, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/components/admin/login-form";
import { isAdminAuthenticated } from "@/lib/auth";
import { adminEmail } from "@/lib/config";

export const metadata: Metadata = {
  title: "Admin Sign In",
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reset?: string }> }) {
  if (await isAdminAuthenticated()) redirect("/admin");
  const { next, reset } = await searchParams;
  const ownerEmail = adminEmail();

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-night px-4 py-12">
      <div className="absolute inset-0">
        <Image src="/images/about-team.jpg" alt="" fill className="object-cover opacity-40" sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 640px" priority />
        <div className="absolute inset-0 bg-gradient-to-br from-night via-ink-950/95 to-brand-900/70" />
      </div>
      <div className="dot-grid absolute inset-0 opacity-[0.15]" />
      <div className="pointer-events-none absolute -left-20 top-10 h-72 w-72 rounded-full bg-brand-500/25 blur-[100px]" />

      <div className="relative w-full max-w-[26rem]">
        <Link href="/" className="mb-5 inline-flex items-center gap-1.5 text-[0.72rem] font-bold text-white/50 transition-colors hover:text-white">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to website
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
            <p className="flex items-center gap-1.5 text-[0.62rem] font-extrabold uppercase tracking-[0.18em] text-mint-300">
              <Lock className="h-3 w-3" /> Restricted access
            </p>
            <h1 className="mt-2 text-xl font-extrabold tracking-tight text-white">Sign in to view submissions</h1>
            <p className="mt-1.5 text-[0.8rem] leading-relaxed text-white/50">Owner access only. All sign-in attempts are logged.</p>
          </div>

          {reset === "success" && (
            <p role="status" className="mt-4 rounded-xl border border-mint-400/25 bg-mint-500/10 px-3 py-2.5 text-[0.72rem] font-semibold text-mint-100">
              Your password was updated. Sign in with the new password.
            </p>
          )}
          <div className="mt-5">
            <AdminLoginForm next={next} />
          </div>
          <div className="mt-3 text-center">
            <Link href="/admin/forgot-password" className="text-[0.7rem] font-semibold text-white/45 transition-colors hover:text-white">
              Forgot password?
            </Link>
          </div>

          <div className="mt-6 flex items-start gap-2 border-t border-white/10 pt-4">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mint-300" />
            <p className="text-[0.66rem] leading-relaxed text-white/40">
              This console is not indexed by search engines. Sessions expire after 8 hours and are protected by an HttpOnly, signed cookie.
            </p>
          </div>
        </div>
        <p className="mt-4 text-center text-[0.66rem] text-white/30">Need help? {ownerEmail} · (812) 994-0046</p>
      </div>
    </div>
  );
}
