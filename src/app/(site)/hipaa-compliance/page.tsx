import { pageMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { FeatureBand } from "@/components/sections/feature-band";
import { pageHeroVisuals } from "@/components/sections/visuals";
import { site } from "@/lib/site";

export const metadata: Metadata = pageMetadata({ title: 'HIPAA & Data Security | Knight Medical Billing', description: 'How Knight Medical Billing protects patient data: HIPAA-compliant processes, business associate agreements, secure data flow and strict quality control.', path: '/hipaa-compliance', keywords: ['hipaa compliant medical billing'] });

export default function HipaaPage() {
  return (
    <>
      <LegalPage
        eyebrow="HIPAA & security"
        title={
          <>
            Protected by <span className="display-serif text-brand-600">design.</span>
          </>
        }
        updated="February 1, 2026"
        intro="Revenue cycle work means handling protected health information every day. Knight Medical Billing meets HIPAA requirements for data and document security. Strict quality control and written information-security policies apply to every client engagement."
        sections={[
          {
            heading: "Our HIPAA compliance",
            paragraphs: ["Knight Medical Billing acts as a business associate of our clients, so we handle protected health information under HIPAA's privacy and security rules. Every engagement begins with a business associate agreement. That agreement defines permitted uses, required safeguards, breach notification and data return obligations."],
            list: [
              "Signed business associate agreement before PHI is exchanged",
              "HIPAA-compliant billing processes end to end",
              "Documented policies for access, breach response and retention",
              "Confidentiality and privacy training for our team",
              "Incident response procedures with client notification",
            ],
          },
          {
            heading: "Data and document security",
            paragraphs: ["Protected health information moves between our team, your facility and your payers through secure channels only. Only the team members working on your account can reach it. Every file transfer follows documented security procedures."],
            list: [
              "Secure data flow between KMB and our partners",
              "Role-based access limited to assigned team members",
              "Dependable networking software and infrastructure",
              "Documented process for file intake and delivery",
              "Confidentiality agreements with all staff",
            ],
          },
          {
            heading: "Our team and training",
            paragraphs: ["Our billers and coders train on HIPAA privacy and security requirements. They also train on the quality-control policies that govern their work. We review coding and privacy practices regularly, and we grant access to client data only where the work requires it."],
          },
          {
            heading: "Strict quality control",
            paragraphs: ["Quality-control and information-security policies apply to every claim we file. Our team reviews each claim for coding accuracy, payer requirements and confidentiality. When an audit finds an error, we correct it quickly."],
          },
          {
            heading: "Vendors and partners",
            paragraphs: ["Where a vendor or partner processes data, confidentiality obligations and appropriate agreements bind them. We require the same security standard from partners that we hold ourselves to."],
          },
          {
            heading: "Reporting a concern",
            paragraphs: [`If you believe a privacy or security incident has occurred, contact us immediately at ${site.email} or ${site.phone}. We escalate suspected incidents immediately during business hours and assess notification obligations under HIPAA and applicable state law.`],
          },
          {
            heading: "Request our documentation",
            paragraphs: ["Prospects and clients can request our business associate agreement template and a summary of the security and quality-control policies that apply to their engagement."],
          },
        ]}
        footer="This page summarizes our practices and is not a substitute for the legal agreements governing an engagement. Contact us for the current agreements before sharing any PHI."
      />

      <FeatureBand
        eyebrow="Security in practice"
        title={
          <>
            Compliance you can <span className="display-serif text-brand-600">audit.</span>
          </>
        }
        description="Safeguards are documented and repeatable, not implied. These are the controls that apply to every engagement before any protected health information changes hands."
        points={[
          "Signed business associate agreement before PHI is exchanged",
          "Role-based access limited to assigned team members",
          "Secure data flow between Knight Medical Billing and our partners",
          "Documented process for file intake and delivery",
        ]}
        visual={pageHeroVisuals.compliance}
        alt="Photograph of clinical documentation being reviewed for compliance"
        cta={{ label: "Talk to our team", href: "/contact" }}
      />
    </>
  );
}
