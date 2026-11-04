import { pageMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { site } from "@/lib/site";

export const metadata: Metadata = pageMetadata({ title: 'Terms of Service | Knight Medical Billing', description: 'Terms governing use of the Knight Medical Billing website and the scope of our medical billing and revenue cycle services.', path: '/terms-of-service', keywords: [] });

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Terms of service"
      title={
        <>
          Clear terms. <span className="display-serif text-brand-600">No surprises.</span>
        </>
      }
      updated="March 1, 2026"
      intro="These terms govern your use of knightmedicalbilling.com. Client engagements are governed by a separate written services agreement and, where PHI is involved, a business associate agreement."
      sections={[
        {
          heading: "Use of this website",
          paragraphs: ["You may use this site for lawful, informational purposes. You agree not to attempt to disrupt the site, access it using automated means that impose unreasonable load, or use its content in a way that infringes our rights or the rights of others."],
        },
        {
          heading: "No professional advice",
          paragraphs: ["Content on this site — including benchmarks, ROI estimates and regulatory summaries — is for general information only. It is not legal, compliance, coding or financial advice, and it may not reflect your payer contracts or jurisdiction. Always verify requirements with your compliance counsel and payers."],
        },
        {
          heading: "Estimates and calculators",
          paragraphs: ["The ROI calculator and performance examples are illustrative models. They are not a guarantee of results. Actual results depend on specialty, payer mix, documentation quality, enrollment status and other practice-specific factors."],
        },
        {
          heading: "Services and agreements",
          paragraphs: ["Descriptions of services, onboarding timelines and performance figures on this site are summaries. Any engagement requires a signed services agreement defining scope, fees, term, termination and data obligations."],
          list: ["No prepayment and no hidden fees", "Fees and scope are defined in the services agreement", "Data and records remain the client's property", "Service levels are defined per engagement"],
        },
        {
          heading: "Intellectual property",
          paragraphs: ["The Knight Medical Billing name, logo, site design, written content, dashboards and methodologies are our property or used with permission. You may share and quote content with attribution but may not resell it or present it as your own."],
        },
        {
          heading: "Third-party links",
          paragraphs: ["We may link to third-party sites or resources. We do not control and are not responsible for their content, security practices or privacy policies."],
        },
        {
          heading: "Limitation of liability",
          paragraphs: ["To the maximum extent permitted by law, we are not liable for indirect, incidental or consequential damages arising from use of this website. Liability under any client services agreement is governed exclusively by that agreement."],
        },
        {
          heading: "Contact",
          paragraphs: [`Questions about these terms? Email ${site.email} or write to ${site.name}, ${site.address}.`],
        },
      ]}
      footer="By using this site you agree to these terms. If you do not agree, please discontinue use. These terms are governed by the laws of the State of Indiana, without regard to conflict-of-law principles."
    />
  );
}
