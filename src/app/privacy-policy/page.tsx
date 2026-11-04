import { pageMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { site } from "@/lib/site";

export const metadata: Metadata = pageMetadata({ title: 'Privacy Policy | Knight Medical Billing', description: 'How Knight Medical Billing collects, uses, protects and discloses information, including protected health information.', path: '/privacy-policy', keywords: [] });

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Privacy policy"
      title={
        <>
          Your information, <span className="display-serif text-brand-600">handled carefully.</span>
        </>
      }
      updated="March 1, 2026"
      intro="This policy explains what we collect through knightmedicalbilling.com, how we use it, and the safeguards that protect it. Protected health information is handled under separate HIPAA business associate agreements."
      sections={[
        {
          heading: "Information we collect",
          paragraphs: ["We collect information you provide directly — such as your name, work email, phone number, practice name and details about your billing needs — when you request an audit, contact us or subscribe to our briefing."],
          list: [
            "Contact and practice details submitted through our forms",
            "Email address for newsletter subscriptions",
            "Usage data such as pages viewed and referring source",
            "Device and browser information for site performance",
            "Any information you choose to include in a message",
          ],
        },
        {
          heading: "How we use information",
          paragraphs: ["We use the information to respond to your request, prepare a revenue audit, deliver requested content, operate and secure the site, and improve our services. We do not sell personal information."],
          list: ["Respond to inquiries and audit requests", "Provide and improve our services", "Send requested briefings and updates", "Meet legal and compliance obligations", "Protect against fraud and abuse"],
        },
        {
          heading: "Protected health information",
          paragraphs: ["We do not ask for PHI through this website. If you become a client, PHI is exchanged only through HIPAA-compliant channels under a signed business associate agreement. We maintain safeguards designed to protect PHI, including secure data flow, role-based access and documented confidentiality and quality control policies."],
        },
        {
          heading: "Cookies and analytics",
          paragraphs: ["We use essential cookies to operate the site and limited analytics to understand aggregate usage. You can control cookies through your browser settings; disabling them may affect site functionality."],
        },
        {
          heading: "Sharing and disclosure",
          paragraphs: ["We share information only with service providers who support our operations under confidentiality obligations, or when required by law. We do not sell, rent or trade personal information."],
        },
        {
          heading: "Your choices and rights",
          paragraphs: ["You may request access to, correction of, or deletion of the personal information you have shared with us. You can unsubscribe from marketing email at any time using the link in the message. Some records must be retained where required by healthcare or financial regulation."],
        },
        {
          heading: "Security and retention",
          paragraphs: ["We retain lead and contact records only as long as needed to serve you or meet legal obligations. Access is limited to team members who need it, and data is exchanged through secure channels with confidentiality agreements in place."],
        },
        {
          heading: "Contact us",
          paragraphs: [`Questions about this policy? Email ${site.email}, call ${site.phone}, or write to ${site.name}, ${site.address}.`],
        },
      ]}
      footer={`This policy may be updated as our services evolve. Material changes will be posted on this page with a new effective date. ${site.name} is a medical billing and revenue cycle management company; nothing on this site constitutes medical or legal advice.`}
    />
  );
}
