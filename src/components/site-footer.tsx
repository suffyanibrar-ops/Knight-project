import { ArrowRight, ArrowUpRight, Clock, Mail, MapPin, Phone } from "lucide-react";
import Link from "next/link";
import { audiences, services, site } from "@/lib/site";
import { Logo } from "./logo";
import { NewsletterForm } from "./newsletter-form";
import { ThemeToggle } from "./theme/theme-toggle";

const companyLinks = [
  { label: "About us", href: "/about" },
  { label: "Our process", href: "/our-process" },
  { label: "Results", href: "/results" },
  { label: "Resources", href: "/insights" },
  { label: "Blog", href: "/blog" },
  { label: "FAQ", href: "/faq" },
  { label: "Contact", href: "/contact" },
];

const socials = [
  {
    label: "LinkedIn",
    href: site.socials.linkedin,
    path: "M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05a3.75 3.75 0 0 1 3.37-1.85c3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45z",
  },
  {
    label: "Instagram",
    href: site.socials.instagram,
    path: "M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.96.24 2.42.4.6.24 1.04.52 1.5.98.46.46.74.9.98 1.5.16.46.35 1.25.4 2.42.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.24 1.96-.4 2.42-.24.6-.52 1.04-.98 1.5-.46.46-.9.74-1.5.98-.46.16-1.25.35-2.42.4-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.96-.24-2.42-.4-.6-.24-1.04-.52-1.5-.98-.46-.46-.74-.9-.98-1.5-.16-.46-.35-1.25-.4-2.42C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.24-1.96.4-2.42.24-.6.52-1.04.98-1.5.46-.46.9-.74 1.5-.98.46-.16 1.25-.35 2.42-.4C8.42 2.17 8.8 2.16 12 2.16zm0 5.68a4.16 4.16 0 1 0 0 8.32 4.16 4.16 0 0 0 0-8.32zm0 6.86a2.7 2.7 0 1 1 0-5.4 2.7 2.7 0 0 1 0 5.4zm5.31-7.03a.97.97 0 1 1-1.94 0 .97.97 0 0 1 1.94 0z",
  },
  {
    label: "Facebook",
    href: site.socials.facebook,
    path: "M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5 3.66 9.15 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.52 1.5-3.92 3.77-3.92 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.91h2.78l-.45 2.91h-2.33V22c4.78-.79 8.44-4.94 8.44-9.94z",
  },
];

/**
 * Simplified footer: one brand block, three short link columns, contact,
 * a slim social row and a legal bar. Newsletter moved into the contact column
 * so the page ends without a dense wall of links.
 */
export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden bg-night text-white">
      <div aria-hidden className="pointer-events-none absolute -left-32 top-0 h-80 w-80 rounded-full bg-brand-600/15 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-mint-600/10 blur-3xl" />

      <div className="shell relative">
        <div className="grid gap-10 py-12 lg:grid-cols-[1.2fr_2fr] lg:gap-14">
          {/* Brand */}
          <div>
            <Logo variant="light" markSize={44} />
            <p className="mt-4 max-w-xs text-[0.85rem] leading-relaxed text-white/60">
              Medical billing and revenue cycle management for independent practices, clinics and specialty groups across the United States.
            </p>

            <div className="mt-5 flex gap-2">
              {socials.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer me"
                  aria-label={`Knight Medical Billing on ${social.label}`}
                  className="grid h-9 w-9 place-items-center rounded-full border border-white/15 text-white/70 transition-colors hover:border-brand-300 hover:bg-white/10 hover:text-white"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden>
                    <path d={social.path} />
                  </svg>
                </a>
              ))}
            </div>

            <div className="mt-5 flex items-center gap-2">
              <ThemeToggle variant="dark" />
              <span className="text-[0.7rem] font-semibold text-white/45">Light / dark theme</span>
            </div>
          </div>

          {/* Links + contact */}
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <nav aria-labelledby="footer-services">
              <p id="footer-services" className="mb-3 text-[0.66rem] font-extrabold uppercase tracking-[0.18em] text-white/40">
                Services
              </p>
              <ul className="space-y-2">
                {services.slice(0, 6).map((service) => (
                  <li key={service.slug}>
                    <Link href={`/services/${service.slug}`} className="text-[0.82rem] text-white/65 transition-colors hover:text-white">
                      {service.short}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link href="/services" className="inline-flex items-center gap-1 text-[0.82rem] font-semibold text-brand-300 transition-colors hover:text-white">
                    All services <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </li>
              </ul>
            </nav>

            <nav aria-labelledby="footer-serve">
              <p id="footer-serve" className="mb-3 text-[0.66rem] font-extrabold uppercase tracking-[0.18em] text-white/40">
                Who we serve
              </p>
              <ul className="space-y-2">
                {audiences.slice(0, 5).map((audience) => (
                  <li key={audience.slug}>
                    <Link href={`/who-we-serve/${audience.slug}`} className="text-[0.82rem] text-white/65 transition-colors hover:text-white">
                      {audience.name}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link href="/specialties" className="inline-flex items-center gap-1 text-[0.82rem] font-semibold text-brand-300 transition-colors hover:text-white">
                    All specialties <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </li>
              </ul>
            </nav>

            <nav aria-labelledby="footer-company">
              <p id="footer-company" className="mb-3 text-[0.66rem] font-extrabold uppercase tracking-[0.18em] text-white/40">
                Company
              </p>
              <ul className="space-y-2">
                {companyLinks.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-[0.82rem] text-white/65 transition-colors hover:text-white">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div>
              <p className="mb-3 text-[0.66rem] font-extrabold uppercase tracking-[0.18em] text-white/40">Contact</p>
              <ul className="space-y-2.5 text-[0.82rem] text-white/65">
                <li>
                  <a href={site.phoneHref} className="flex items-start gap-2 transition-colors hover:text-white">
                    <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-300" aria-hidden /> {site.phone}
                  </a>
                </li>
                <li>
                  <a href={`mailto:${site.email}`} className="flex items-start gap-2 break-all transition-colors hover:text-white">
                    <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-300" aria-hidden /> {site.email}
                  </a>
                </li>
                <li>
                  <a href={site.mapLink} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2 transition-colors hover:text-white">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-300" aria-hidden /> 585 Grove St Ste 145, Herndon, VA 20170-4790
                  </a>
                </li>
                <li className="flex items-start gap-2">
                  <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-300" aria-hidden /> Mon–Fri, 8:00 AM – 5:00 PM ET
                </li>
              </ul>

              <div className="mt-4">
                <Link href="/schedule-form" className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-2 text-[0.74rem] font-bold text-white transition-colors hover:bg-brand-500">
                  Request a consultation <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              <div className="mt-4 max-w-[15rem]">
                <p className="mb-1.5 text-[0.66rem] font-extrabold uppercase tracking-[0.14em] text-white/40">Billing insights</p>
                <NewsletterForm />
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-white/10 py-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[0.72rem] text-white/40">
            © {new Date().getFullYear()} {site.name}. All rights reserved.
          </p>
          <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-2 text-[0.72rem] text-white/45">
            <Link href="/privacy-policy" className="transition-colors hover:text-white">
              Privacy
            </Link>
            <Link href="/terms-of-service" className="transition-colors hover:text-white">
              Terms
            </Link>
            <Link href="/hipaa-compliance" className="transition-colors hover:text-white">
              HIPAA &amp; security
            </Link>
            <Link href="/sitemap.xml" className="transition-colors hover:text-white">
              Sitemap
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
