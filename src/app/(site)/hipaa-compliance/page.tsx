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
        intro="Revenue cycle work means handling protected health information every day. Knight Medical Billing follows HIPAA requirements with complete data and document security, strict quality control and information security policies across every client engagement."
        sections={[
          {
            heading: "Our HIPAA compliance",
            paragraphs: ["Knight Medical Billing handles protected health information as a business associate of our clients. We follow HIPAA requirements for privacy and security, and every engagement begins with a business associate agreement that defines permitted uses, safeguards, breach notification and data return obligations."],
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
            paragraphs: ["Protected health information moves between our team, your facility and your payers through secure channels only. Access is limited to the team members working on your account, and every file transfer follows documented security procedures."],
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
            paragraphs: ["Our billers and coders are trained on HIPAA privacy and security requirements and on the quality control policies that govern their work. Coding and privacy practices are reviewed regularly, and access to client data is granted only where it is needed to perform the work."],
          },
          {
            heading: "Strict quality control",
            paragraphs: ["Quality control and information security policies apply to every claim we file. Work is reviewed for coding accuracy, payer requirements and confidentiality, and any error identified during auditing is corrected quickly."],
          },
          {
            heading: "Vendors and partners",
            paragraphs: ["Where a vendor or partner is involved in processing data, they are bound by confidentiality obligations and appropriate agreements. We require the same standard of security from partners that we hold ourselves to."],
          },
          {
            heading: "Reporting a concern",
            paragraphs: [`If you believe there has been a privacy or security incident, contact us immediately at ${site.email} or ${site.phone}. Suspected incidents are escalated immediately during business hours, with notification obligations assessed under HIPAA and applicable state law.`],
          },
          {
            heading: "Request our documentation",
            paragraphs: ["Prospects and clients can request our business associate agreement template and a summary of the security and quality control policies that apply to their engagement."],
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
        alt="Abstract illustration of HIPAA-compliant data protection"
        cta={{ label: "Talk to our team", href: "/contact" }}
      />
    </>
  );
}
