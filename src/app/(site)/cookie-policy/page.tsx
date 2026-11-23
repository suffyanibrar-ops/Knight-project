import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/seo";
import { PageHero } from "@/components/page-hero";
import { CookieSettingsLink } from "@/components/cookie-settings-link";
import { site } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Cookie Policy",
  description: "Which cookies and browser storage Knight Medical Billing uses, why, and how to change your choice at any time.",
  path: "/cookie-policy",
});

const inventory = [
  { name: "kmb_admin_session", type: "Essential cookie", purpose: "Keeps an administrator signed in to the admin console. Never set for website visitors.", duration: "Session", party: "First party" },
  { name: "gsc_oauth_state", type: "Essential cookie", purpose: "Protects the one-time Search Console OAuth handshake in the admin console.", duration: "10 minutes", party: "First party" },
  { name: "kmb-consent", type: "Essential storage", purpose: "Remembers the cookie choice you made, including its version and timestamp.", duration: "Until cleared", party: "First party" },
  { name: "kmb-analytics-optout", type: "Essential storage", purpose: "Honours a visitor's earlier analytics opt-out so it is never overridden.", duration: "Until cleared", party: "First party" },
  { name: "kmb-offer-state", type: "Functional storage", purpose: "Remembers a dismissed contextual offer so it is not shown repeatedly.", duration: "Until cleared", party: "First party" },
  { name: "kmb-offer-session", type: "Functional storage", purpose: "Keeps one-session offer limits and page count; expires when the tab closes.", duration: "Session", party: "First party" },
  { name: "kmb-utm", type: "Functional storage", purpose: "Keeps campaign parameters for the current visit so an enquiry can be attributed.", duration: "Session", party: "First party" },
  { name: "First-party page-view measurement", type: "Analytics (opt-in)", purpose: "Records anonymous page views, referrers and device class on our own server. No advertising identifiers, no cross-site profile.", duration: "Rolling retention", party: "First party" },
] as const;

export default function CookiePolicyPage() {
  return (
    <>
      <PageHero
        eyebrow="Privacy"
        title="Cookie policy"
        description="What we store in your browser, why we store it, and how to change your choice."
      />
      <section className="bg-surface py-14 sm:py-20">
        <div className="shell max-w-3xl space-y-8 text-[0.92rem] leading-relaxed text-ink-700">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-mist-200 bg-mist-50 p-4 text-[0.8rem] text-ink-700">
            <p>You can change your cookie choice at any time.</p>
            <CookieSettingsLink className="rounded-full border border-brand-200 bg-surface px-3.5 py-2 text-[0.72rem] font-bold text-brand-700 hover:border-brand-400" />
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-[0.82rem] text-amber-900">
            <p className="font-extrabold">Please do not send patient information through this website.</p>
            <p className="mt-1">
              General website forms, the AI chat and email links are for business enquiries only. Do not submit medical records, claim attachments or any protected health information (PHI). If you need to share records, contact us first so an appropriate secure channel and business associate agreement can be arranged.
            </p>
          </div>

          <section>
            <h2 className="text-[1.15rem] font-extrabold text-ink-950">What this page covers</h2>
            <p className="mt-2">
              This page lists the cookies and browser storage used by {site.name}. It reflects what the website actually sets today; there are no advertising or social-media tracking pixels on this site.
            </p>
          </section>

          <section>
            <h2 className="text-[1.15rem] font-extrabold text-ink-950">Categories</h2>
            <ul className="mt-2 space-y-2">
              <li><strong>Essential</strong> — required for the site and the admin console to work. These cannot be switched off.</li>
              <li><strong>Functional</strong> — small conveniences such as remembering a dismissed contextual offer.</li>
              <li><strong>Analytics</strong> — first-party page-view measurement, enabled only if you accept. No advertising identifiers are used.</li>
              <li><strong>Marketing</strong> — not currently used anywhere on this site.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[1.15rem] font-extrabold text-ink-950">Inventory</h2>
            <div className="mt-3 overflow-x-auto rounded-2xl border border-mist-200">
              <table className="w-full min-w-[44rem] text-left text-[0.78rem]">
                <thead className="bg-mist-50 text-[0.6rem] font-extrabold uppercase tracking-[0.08em] text-ink-600">
                  <tr>
                    <th className="px-3 py-2.5">Name</th>
                    <th className="px-3 py-2.5">Category</th>
                    <th className="px-3 py-2.5">Purpose</th>
                    <th className="px-3 py-2.5">Duration</th>
                    <th className="px-3 py-2.5">Party</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.map((row) => (
                    <tr key={row.name} className="border-t border-mist-100 align-top">
                      <td className="px-3 py-2.5 font-mono text-[0.72rem] text-ink-900">{row.name}</td>
                      <td className="px-3 py-2.5">{row.type}</td>
                      <td className="px-3 py-2.5">{row.purpose}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{row.duration}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{row.party}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-[1.15rem] font-extrabold text-ink-950">Changing your choice</h2>
            <p className="mt-2">
              Use the <strong>Cookie settings</strong> control in the corner of any page to accept everything, reject optional storage, or choose categories individually. Your choice is stored with the date it was made and the policy version; if the policy changes materially you will be asked again.
            </p>
          </section>

          <section>
            <h2 className="text-[1.15rem] font-extrabold text-ink-950">Data we do not collect</h2>
            <p className="mt-2">
              We do not run advertising networks, we do not build cross-site profiles, and we do not send form contents or chat transcripts to analytics providers. Analytics records aggregate page views and referrers only.
            </p>
          </section>

          <section>
            <h2 className="text-[1.15rem] font-extrabold text-ink-950">Related pages</h2>
            <p className="mt-2">
              <Link href="/privacy-policy" className="font-bold text-brand-700 underline">Privacy policy</Link> · <Link href="/hipaa-compliance" className="font-bold text-brand-700 underline">HIPAA and data security</Link> · <Link href="/contact" className="font-bold text-brand-700 underline">Contact us</Link>
            </p>
          </section>

          <p className="rounded-xl border border-mist-200 bg-mist-50 p-4 text-[0.76rem] text-ink-600">
            This page describes our practices; it is not legal advice and does not by itself establish compliance with any particular regulation. Questions: <a href={`mailto:${site.email}`} className="font-bold text-brand-700 underline">{site.email}</a>.
          </p>
        </div>
      </section>
    </>
  );
}
