import Image from "next/image";
import { ArrowLeft, ArrowRight, Compass, Phone } from "lucide-react";
import Link from "next/link";
import { site } from "@/lib/site";

export default function NotFound() {
  return (
    <section className="relative overflow-hidden bg-mist-50">
      <div className="grid-lines pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_at_top,black,transparent_75%)]" />
      <div className="shell relative flex min-h-[70vh] flex-col items-center justify-center py-16 text-center">
        <div className="flex items-center gap-3">
          <Image src={site.logo} alt="" width={48} height={48} className="h-11 w-11" />
          <span className="h-8 w-px bg-mist-300" />
          <span className="text-[0.7rem] font-extrabold uppercase tracking-[0.2em] text-ink-600/80">Page not found</span>
        </div>
        <p className="mt-6 text-[clamp(4rem,14vw,8rem)] font-extrabold leading-none tracking-[-0.06em] text-ink-950">404</p>
        <h1 className="mt-3 max-w-xl text-[clamp(1.4rem,3vw,2rem)] font-extrabold leading-tight tracking-[-0.03em] text-ink-950">
          This claim never made it to the payer.
        </h1>
        <p className="mt-3 max-w-md text-[0.94rem] leading-relaxed text-ink-600/75">
          The page you are looking for moved or never existed. Let&apos;s get you back to revenue.
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Link href="/" className="btn btn-primary">
            <ArrowLeft className="h-4 w-4" /> Back home
          </Link>
          <Link href="/contact" className="btn btn-light">
            <Phone className="h-4 w-4" /> Contact us
          </Link>
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[0.78rem] font-bold text-brand-700">
          {[
            { label: "Services", href: "/services" },
            { label: "Specialties", href: "/specialties" },
            { label: "Schedule a consultation", href: "/schedule-form" },
            { label: "Results", href: "/results" },
            { label: "Insights", href: "/insights" },
          ].map((link) => (
            <Link key={link.href} href={link.href} className="inline-flex items-center gap-1 transition-colors hover:text-brand-500">
              {link.label} <ArrowRight className="h-3 w-3" />
            </Link>
          ))}
        </div>
        <div className="mt-8 flex items-center gap-2 rounded-full border border-mist-200 bg-surface px-4 py-2 text-[0.72rem] font-semibold text-ink-600/80">
          <Compass className="h-3.5 w-3.5 text-brand-600" /> Lost? Call {site.phone} and a human will help.
        </div>
      </div>
    </section>
  );
}
