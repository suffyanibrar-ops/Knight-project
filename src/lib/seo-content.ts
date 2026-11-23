import type { Article } from "./site";
import { photo } from "./photos";

export type SoftwarePlatform = {
  slug: string;
  name: string;
  formerName?: string;
  title: string;
  description: string;
  eyebrow: string;
  h1: string;
  intro: string;
  image: string;
  imageAlt: string;
  badges: string[];
  why: { title: string; detail: string }[];
  workflow: { title: string; detail: string }[];
  manages: string[];
  unchanged: string[];
  problems: { title: string; detail: string }[];
  reporting: string[];
  serviceSlugs: string[];
  specialtySlugs: string[];
  relatedSoftware: string[];
  faqs: { q: string; a: string }[];
};

export const softwarePlatforms: SoftwarePlatform[] = [
  {
    slug: "advancedmd-medical-billing",
    name: "AdvancedMD",
    title: "AdvancedMD Medical Billing Services | Knight Medical Billing",
    description: "Knight Medical Billing works inside AdvancedMD to manage claims, denials, A/R, payment posting, eligibility and reporting for independent practices and growing groups.",
    eyebrow: "AdvancedMD billing support",
    h1: "AdvancedMD billing, handled inside the system you already use.",
    intro: "You do not need to replace AdvancedMD to improve the revenue cycle. Our billing team works within your existing AdvancedMD workflow, focusing on the claim, denial and follow-up work that determines how quickly services turn into collected revenue.",
    image: photo.advancedmdBillingWorkflow,
    imageAlt: "Administrator working with practice paperwork and a tablet",
    badges: ["Works in AdvancedMD", "No software migration", "Dedicated billing team"],
    why: [
      { title: "The system is not the bottleneck", detail: "AdvancedMD can hold the right data while claims still sit because ownership, worklists and follow-up are inconsistent. We focus on the operating discipline around the software." },
      { title: "A queue with an owner", detail: "Charges, rejected claims, denials and aged balances are assigned and worked on a cadence instead of waiting for someone to have time." },
      { title: "Specialty context matters", detail: "The same claim fields need different review depending on whether you bill behavioral health, physical therapy, podiatry or another specialty." },
    ],
    workflow: [
      { title: "Access and workflow review", detail: "We review how your team uses AdvancedMD today, including charge entry, clearinghouse connections, posting and current worklists." },
      { title: "Clean-claim checks", detail: "Before submission, we review eligibility, authorization, coding, modifiers and payer-specific requirements visible in the claim." },
      { title: "Submission and acknowledgement", detail: "Claims move through a daily queue. Rejections and payer acknowledgements are reviewed while the filing window is open." },
      { title: "Posting, denials and A/R", detail: "ERAs and manual remittances are posted, underpayments are flagged and aged balances are worked by payer and deadline." },
    ],
    manages: [
      "Charge entry and demographic validation",
      "Claim scrubbing and submission support",
      "Clearinghouse rejection review",
      "ERA and manual payment posting",
      "Denial investigation and appeals",
      "A/R follow-up by aging bucket",
      "Eligibility and benefits checks",
      "Prior authorization tracking",
      "Credentialing and payer enrollment support",
      "Monthly revenue-cycle reporting",
    ],
    unchanged: [
      "Your AdvancedMD subscription and configuration",
      "Your existing clearinghouse connection where it is working",
      "Your clinical and scheduling workflow",
      "Your patient records and practice data",
    ],
    problems: [
      { title: "Rejected claims not worked quickly", detail: "A rejected claim is not the same as a denial. We review the rejection reason and correct it before the filing deadline." },
      { title: "Denials without root-cause review", detail: "Repeated denial reasons usually point to a front-end data, coding or authorization issue. We document the pattern and feed it back." },
      { title: "Aged A/R with no next action", detail: "We segment outstanding balances by payer, age and collectability so the team knows what to work next." },
    ],
    reporting: ["Collections and payer mix", "Claim submission and rejection trends", "Denial reasons by payer", "Aged A/R and days in A/R", "Charge lag and documentation follow-up"],
    serviceSlugs: ["complete-rcm-services", "claims-management", "denial-management", "accounts-receivable-management", "eligibility-and-benefits-verification"],
    specialtySlugs: ["mental-health-billing", "physical-therapy-billing", "podiatry-billing"],
    relatedSoftware: ["eclinicalworks-medical-billing", "nextgen-medical-billing", "collaboratemd-medical-billing"],
    faqs: [
      { q: "Do we have to leave AdvancedMD?", a: "No. The engagement is designed around working in your existing AdvancedMD environment wherever access and permissions allow." },
      { q: "Can you work with our current clearinghouse?", a: "We review the current clearinghouse and payer connections first. Where they work, we keep them; where they do not, we identify the specific issue before recommending a change." },
      { q: "How do you handle a backlog already in AdvancedMD?", a: "We review open claims and A/R, prioritize by filing and appeal deadlines, then work the backlog while keeping new claims current." },
    ],
  },
  {
    slug: "eclinicalworks-medical-billing",
    name: "eClinicalWorks",
    title: "eClinicalWorks Medical Billing Services | Knight Medical Billing",
    description: "Medical billing inside eClinicalWorks: claim review, eligibility, denials, payment posting, A/R follow-up and reporting for practices and groups.",
    eyebrow: "eClinicalWorks billing support",
    h1: "Revenue-cycle support that fits your eClinicalWorks workflow.",
    intro: "eClinicalWorks gives your practice a single clinical and financial record. Our team works inside that environment to keep the financial side moving — from eligibility and charge review through claim follow-up, posting and reporting.",
    image: photo.eclinicalworksRevenueCycle,
    imageAlt: "Practice team coordinating at a clinic front desk",
    badges: ["Works in eClinicalWorks", "Practice-friendly onboarding", "No rip-and-replace"],
    why: [
      { title: "Keep clinical and billing data together", detail: "We use the record your team already maintains rather than creating a parallel billing spreadsheet or another disconnected system." },
      { title: "Front-to-back ownership", detail: "Eligibility, authorization, charge review, claims, posting and denials are treated as one chain. A gap at the front becomes visible at the back." },
      { title: "Built for growing practices", detail: "New providers and locations add complexity. We help keep the worklist, payer setup and reporting understandable as the practice grows." },
    ],
    workflow: [
      { title: "Review the current configuration", detail: "We inspect the existing billing workflow, payer connections, worklists and reporting so the handoff matches how your practice actually operates." },
      { title: "Validate before filing", detail: "Demographics, coverage, authorization, coding and modifiers are checked against the encounter and payer requirements." },
      { title: "Track the claim", detail: "Submission, acceptance, rejection and denial status are monitored rather than assumed." },
      { title: "Close the loop", detail: "Payments are posted accurately and recurring denial causes are documented for front-end correction." },
    ],
    manages: [
      "Eligibility and benefits verification",
      "Charge entry review",
      "Claim scrubbing and submission",
      "Payer rejection follow-up",
      "ERA and EOB posting",
      "Denial management and appeals",
      "A/R follow-up",
      "Patient balance support",
      "Credentialing and enrollment coordination",
      "Monthly performance reporting",
    ],
    unchanged: [
      "Your eClinicalWorks platform",
      "Your clinical documentation workflow",
      "Your existing patient and claim records",
      "Your scheduling and front-office process",
    ],
    problems: [
      { title: "Claims accepted but not paid", detail: "Acceptance is not adjudication. We track claims beyond the clearinghouse acknowledgement and review payer delays." },
      { title: "Eligibility data entered late", detail: "We look for where coverage and authorization data enters the encounter and how to catch gaps before charge entry." },
      { title: "Denials repeating by payer", detail: "Payer-specific denial patterns are summarized so the clinical and billing teams can correct the source." },
    ],
    reporting: ["Claim acceptance and rejection rates", "Denial volume and reason trends", "A/R aging by payer", "Payment posting and credit balances", "Eligibility and authorization exceptions"],
    serviceSlugs: ["medical-billing-and-coding", "claims-management", "payment-posting", "denial-management", "accounts-receivable-management"],
    specialtySlugs: ["mental-health-billing", "physical-therapy-billing", "podiatry-billing"],
    relatedSoftware: ["advancedmd-medical-billing", "nextgen-medical-billing", "tebra-kareo-medical-billing"],
    faqs: [
      { q: "Will you need access to our eClinicalWorks system?", a: "We agree on the minimum access needed for billing, follow-up and reporting before onboarding. Access is documented and limited to the work in scope." },
      { q: "Can you support multiple locations?", a: "Yes. We review location-specific payer setup, provider assignments and worklists so reporting does not blur the locations together." },
      { q: "Do you replace our billing staff?", a: "The scope can supplement an existing team or take over defined functions. The division of work is agreed in writing before the engagement begins." },
    ],
  },
  {
    slug: "nextgen-medical-billing",
    name: "NextGen",
    title: "NextGen Medical Billing Services | Knight Medical Billing",
    description: "Knight Medical Billing provides billing, claims, denial and A/R support within NextGen workflows for independent practices, specialty groups and multi-provider organizations.",
    eyebrow: "NextGen billing support",
    h1: "NextGen billing support for practices that need the detail owned.",
    intro: "Your NextGen environment already contains the encounter, payer and claim information. The work that decides revenue is what happens next: the review before submission, the follow-up after adjudication and the correction of recurring problems.",
    image: photo.nextgenMedicalBilling,
    imageAlt: "Clinician reviewing notes beside a laptop",
    badges: ["Works in NextGen", "Multi-provider support", "Specialty-aware billing"],
    why: [
      { title: "One accountable worklist", detail: "Instead of separate queues with unclear owners, claims, denials and aged balances are assigned and reviewed on a consistent cadence." },
      { title: "Designed for multi-provider detail", detail: "Provider-level reporting and claim review help separate a practice-wide problem from a single provider or location issue." },
      { title: "No forced migration", detail: "We work in your existing system where access allows, so your staff does not have to learn a new billing platform to get support." },
    ],
    workflow: [
      { title: "Map the NextGen workflow", detail: "We review charge capture, payer setup, claim creation, clearinghouse flow and existing follow-up responsibilities." },
      { title: "Review before release", detail: "Coding, modifiers, eligibility and authorization details are checked before the claim leaves the practice." },
      { title: "Work the exceptions", detail: "Rejections and denials are routed to a named owner with a next action and a deadline." },
      { title: "Report the result", detail: "Reporting separates submission activity from actual collections and outstanding balances." },
    ],
    manages: [
      "Charge and claim review",
      "Eligibility and benefits verification",
      "Prior authorization coordination",
      "Claim submission and rejection follow-up",
      "Payment posting and reconciliation",
      "Denial appeals and corrected claims",
      "A/R follow-up by provider and payer",
      "Credentialing and payer maintenance",
      "Patient balance support",
      "Provider-level reporting",
    ],
    unchanged: [
      "Your NextGen platform and clinical data",
      "Your existing scheduling and front-office workflows",
      "Your current payer relationships where they are sound",
      "Your internal approval and escalation process",
    ],
    problems: [
      { title: "A/R that hides by provider", detail: "Practice-wide totals can conceal a single provider, location or payer problem. We break the A/R down before deciding what to work first." },
      { title: "Unclear denial ownership", detail: "Every denial needs a documented reason, owner and next action. Otherwise it becomes an aging balance with no history." },
      { title: "Reporting that arrives too late", detail: "Monthly totals without actionable detail do not prevent the next month's problem. We connect the metric to a workflow owner." },
    ],
    reporting: ["Claims submitted and accepted", "Denials by reason and provider", "A/R aging by location", "Payment posting exceptions", "Credentialing and enrollment status"],
    serviceSlugs: ["complete-rcm-services", "accounts-receivable-management", "denial-management", "credentialing-and-contracting", "revenue-performance-reporting"],
    specialtySlugs: ["mental-health-billing", "physical-therapy-billing", "podiatry-billing"],
    relatedSoftware: ["advancedmd-medical-billing", "eclinicalworks-medical-billing", "experity-docutap-medical-billing"],
    faqs: [
      { q: "Can you support a multi-location NextGen practice?", a: "Yes. We review each location's payer setup and worklist before assigning responsibility, then report by location so issues stay visible." },
      { q: "Who handles credentialing inside NextGen?", a: "Credentialing and payer enrollment can be included in scope. The exact responsibility is agreed before work begins." },
      { q: "Do you provide provider-level reporting?", a: "Reporting can separate providers and locations where the underlying claim and encounter data support it. We agree on the report structure during onboarding." },
    ],
  },
  {
    slug: "tebra-kareo-medical-billing",
    name: "Tebra",
    formerName: "formerly Kareo",
    title: "Tebra (Kareo) Medical Billing Services | Knight Medical Billing",
    description: "Billing support for Tebra (formerly Kareo) practices: claim review, eligibility, denials, payment posting and A/R follow-up inside your workflow.",
    eyebrow: "Tebra (formerly Kareo) billing support",
    h1: "Tebra billing support, without a platform change.",
    intro: "Tebra, formerly Kareo, is the operating system for many independent practices. We work within that environment to make sure the financial workflow is actually being worked: eligibility before the visit, clean claims, posted payments and follow-up on every balance.",
    image: photo.tebraPracticeBilling,
    imageAlt: "Medical administrator organizing a practice billing calendar",
    badges: ["Tebra (formerly Kareo)", "Independent-practice focus", "No migration required"],
    why: [
      { title: "Independent practices need an owner", detail: "A small team often has the software but not the capacity to work every queue. We add the operating discipline without adding another platform." },
      { title: "The workflow matters more than the button", detail: "A claim can be created correctly in Tebra and still fail if authorization, coding or payer setup is wrong. We review the whole chain." },
      { title: "Clear communication with the practice", detail: "You get a named contact, a consistent reporting rhythm and plain explanations of what is stuck and why." },
    ],
    workflow: [
      { title: "Understand your Tebra setup", detail: "We review your current billing workflow, clearinghouse connection, provider setup and reporting." },
      { title: "Verify the encounter", detail: "Coverage, authorization, coding and modifier details are checked before the claim is released." },
      { title: "Follow the money", detail: "Rejections, denials, underpayments and patient balances are worked with documented next actions." },
      { title: "Review the numbers", detail: "We report what changed, what remains open and which workflow fix should happen next." },
    ],
    manages: [
      "Eligibility and benefits verification",
      "Charge entry and coding review",
      "Claim submission and scrubbing",
      "Denial follow-up and appeals",
      "ERA/EOB payment posting",
      "A/R follow-up",
      "Patient statement support",
      "Credentialing and payer enrollment",
      "Provider onboarding support",
      "Monthly revenue reporting",
    ],
    unchanged: [
      "Your Tebra account and patient records",
      "Your existing workflow where it is working",
      "Your practice's patient communication process",
      "Your current clearinghouse connections where sound",
    ],
    problems: [
      { title: "Claims that never leave the queue", detail: "A backlog often starts with an unclear owner or a missing data field. We identify the block and clear it at the source." },
      { title: "Patients calling about balances", detail: "Accurate eligibility and posting reduce avoidable patient questions and make statements easier to explain." },
      { title: "Reporting that is not used", detail: "We turn monthly reporting into a short list of actions with owners, not a static dashboard." },
    ],
    reporting: ["Collections by provider", "Claim rejection and denial patterns", "A/R aging", "Payment posting exceptions", "Patient balance trends"],
    serviceSlugs: ["medical-billing-and-coding", "denial-management", "accounts-receivable-management", "complete-patient-billing", "credentialing-and-contracting"],
    specialtySlugs: ["mental-health-billing", "physical-therapy-billing", "podiatry-billing"],
    relatedSoftware: ["advancedmd-medical-billing", "collaboratemd-medical-billing", "eclinicalworks-medical-billing"],
    faqs: [
      { q: "Is Kareo now Tebra?", a: "Yes. Tebra is the current brand commonly used for the platform formerly known as Kareo. We use Tebra as the primary name and note the former name to avoid confusion." },
      { q: "Do we need to change software?", a: "No. The engagement is designed around working within your existing Tebra environment where access allows." },
      { q: "Can you help a solo practice?", a: "Yes. The scope can be tailored to a solo provider or a growing group; the first step is a review of the current workflow and backlog." },
    ],
  },
  {
    slug: "collaboratemd-medical-billing",
    name: "CollaborateMD",
    title: "CollaborateMD Medical Billing Services | Knight Medical Billing",
    description: "Billing support for practices using CollaborateMD: claims, eligibility, denials, payment posting, A/R follow-up and transparent reporting.",
    eyebrow: "CollaborateMD billing support",
    h1: "CollaborateMD billing support with follow-through.",
    intro: "CollaborateMD can handle the transaction. The difference is whether someone owns the exceptions. Our team works in your existing CollaborateMD environment to review claims before submission and pursue the denials, underpayments and aged balances that follow.",
    image: photo.collaboratemdBillingWorkflow,
    imageAlt: "Professional working through billing details on a laptop",
    badges: ["Works in CollaborateMD", "Claims and A/R focus", "No new platform"],
    why: [
      { title: "Exceptions need a name", detail: "Rejected claims, denials and underpayments should not sit in a shared inbox. We assign ownership and document the next step." },
      { title: "Small-practice practicality", detail: "The process is designed to be understandable to an independent practice, not to bury the owner in operational jargon." },
      { title: "Clean data at the source", detail: "Eligibility, authorization and charge review are treated as upstream controls, not separate tasks after the denial arrives." },
    ],
    workflow: [
      { title: "Review the current setup", detail: "We inspect payer setup, clearinghouse flow, charge entry and existing follow-up practices." },
      { title: "Check before submission", detail: "Eligibility, authorization, coding and claim data are reviewed before the claim is filed." },
      { title: "Work the response", detail: "Acceptances, rejections, denials and underpayments are reviewed and routed to an owner." },
      { title: "Report and correct", detail: "We summarize recurring reasons and recommend the workflow change that prevents the same issue." },
    ],
    manages: [
      "Eligibility checks",
      "Charge entry review",
      "Claim scrubbing and submission",
      "Clearinghouse rejection handling",
      "ERA/EOB posting",
      "Denial and appeal management",
      "A/R follow-up",
      "Patient balance support",
      "Credentialing coordination",
      "Monthly reporting",
    ],
    unchanged: [
      "Your CollaborateMD account",
      "Your patient and encounter records",
      "Your scheduling workflow",
      "Your existing payer relationships",
    ],
    problems: [
      { title: "A shared queue with no owner", detail: "A queue is not a process. We define who works which exception and when, so items do not silently age." },
      { title: "Unworked rejections", detail: "Rejections need to be corrected before they become denials. We prioritize by filing deadline." },
      { title: "Reporting without action", detail: "Every report should answer what changed and what the team will do next. We build the review around that." },
    ],
    reporting: ["Claim status and rejections", "Denials by reason", "A/R aging", "Posting differences", "Payment and collection trends"],
    serviceSlugs: ["medical-billing-and-coding", "claims-management", "denial-management", "accounts-receivable-management", "complete-rcm-services"],
    specialtySlugs: ["mental-health-billing", "physical-therapy-billing", "podiatry-billing"],
    relatedSoftware: ["tebra-kareo-medical-billing", "advancedmd-medical-billing", "nextgen-medical-billing"],
    faqs: [
      { q: "Do you work in our existing CollaborateMD account?", a: "Yes, where access and permissions allow. We document the access required and agree on scope before onboarding." },
      { q: "Can you take over only A/R follow-up?", a: "Yes. The engagement can focus on a specific function such as A/R follow-up or denial work instead of the full revenue cycle." },
      { q: "How will we know what is happening?", a: "You receive a consistent reporting rhythm and a named contact who can explain the current worklist and the next action." },
    ],
  },
  {
    slug: "experity-docutap-medical-billing",
    name: "Experity",
    formerName: "formerly DocuTAP",
    title: "Experity (DocuTAP) Medical Billing Services | Knight Medical Billing",
    description: "Urgent-care billing inside Experity (formerly DocuTAP): eligibility, claims, denials, payment posting and A/R follow-up for high-volume practices.",
    eyebrow: "Experity (formerly DocuTAP) billing support",
    h1: "Experity billing support built for urgent-care pace.",
    intro: "Experity, formerly DocuTAP, is built around the urgent-care encounter. The billing workflow around it has to keep up with the same pace: quick eligibility checks, clean claims, fast rejection handling and persistent follow-up on the balances that remain.",
    image: photo.experityBillingServices,
    imageAlt: "Clinician working at a desk in a modern care environment",
    badges: ["Experity (formerly DocuTAP)", "Urgent-care workflow", "High-volume support"],
    why: [
      { title: "Volume makes small errors expensive", detail: "At urgent-care volume, a repeated registration or coding error becomes a large denial pattern quickly. We look for the repeated cause, not just the individual claim." },
      { title: "Front desk and billing must connect", detail: "Copay, eligibility and authorization data should reach the claim cleanly. We review the handoff, not just the final claim." },
      { title: "Follow-up cannot wait", detail: "Urgent-care claims are often small and numerous. They still need an owner and a worklist, or the easy ones get paid and the rest age." },
    ],
    workflow: [
      { title: "Map the urgent-care flow", detail: "We review registration, eligibility, point-of-service collection and the path into Experity." },
      { title: "Scrub at volume", detail: "Claims are reviewed for recurring data, coding and payer issues rather than treated as isolated transactions." },
      { title: "Clear rejections fast", detail: "Rejections are corrected while filing deadlines are open, and recurring rejection reasons are documented." },
      { title: "Persist on A/R", detail: "Aged balances are worked by payer and reason, with patient responsibility separated from payer responsibility." },
    ],
    manages: [
      "Eligibility and benefits verification",
      "Charge entry and coding review",
      "Claim submission",
      "Rejection and denial follow-up",
      "ERA/EOB posting",
      "A/R follow-up",
      "Patient balance support",
      "Payer enrollment and credentialing support",
      "Reporting on volume and denials",
      "Workflow feedback to the front desk",
    ],
    unchanged: [
      "Your Experity platform and clinical records",
      "Your urgent-care scheduling and registration flow",
      "Your existing payer connections where they work",
      "Your patient communication process",
    ],
    problems: [
      { title: "Same error across many visits", detail: "High volume amplifies a single registration or coding mistake. We look for the pattern and fix the source." },
      { title: "Small balances that age", detail: "Low-dollar claims can be overlooked. A consistent worklist prevents them from becoming uncollectible." },
      { title: "Front-desk data gaps", detail: "Missing eligibility or authorization data is easier to correct at registration than after the claim is denied." },
    ],
    reporting: ["Visit and claim volume", "Rejection and denial reasons", "A/R aging", "Point-of-service collections", "Payer performance trends"],
    serviceSlugs: ["medical-billing-and-coding", "claims-management", "denial-management", "accounts-receivable-management", "eligibility-and-benefits-verification"],
    specialtySlugs: ["mental-health-billing", "physical-therapy-billing", "podiatry-billing"],
    relatedSoftware: ["advancedmd-medical-billing", "eclinicalworks-medical-billing", "tebra-kareo-medical-billing"],
    faqs: [
      { q: "Is DocuTAP now Experity?", a: "Yes. Experity is the current brand commonly used for the platform formerly known as DocuTAP. We use Experity as the primary name and note the former name to avoid confusion." },
      { q: "Do you support urgent-care billing specifically?", a: "Yes. Urgent care is one of the practice settings already listed on our site, and the billing workflow can be scoped around its volume and payer mix." },
      { q: "Can you work with our front desk?", a: "We can provide feedback and training recommendations for registration, eligibility and point-of-service collection where those handoffs affect the claim." },
    ],
  },
];

export const softwareHub = {
  title: "Medical Billing Software & EHR Expertise | Knight Medical Billing",
  description: "Billing support inside the systems you already use — AdvancedMD, eClinicalWorks, NextGen, Tebra, CollaborateMD and Experity.",
  eyebrow: "Software & EHR expertise",
  h1: "Medical billing that works inside your existing software.",
  intro: "You should not have to replace your EHR or practice-management system to improve the revenue cycle. Our billing team works within the systems practices already use, focusing on the claim, denial and follow-up work that determines how quickly revenue is collected.",
};

export const otherSoftware = ["Medisoft", "Medical Manager", "GoRev", "Elligence", "Epic", "Cerner"];

export type SpecialtyBillingGuide = {
  slug: string;
  name: string;
  title: string;
  description: string;
  h1: string;
  intro: string;
  image: string;
  imageAlt: string;
  sections: { title: string; body: string; points?: string[] }[];
  services: string[];
  software: string[];
  faqs: { q: string; a: string }[];
};

export const specialtyBillingGuides: SpecialtyBillingGuide[] = [
  {
    slug: "mental-health-billing",
    name: "Mental Health",
    title: "Mental Health Billing Services | Knight Medical Billing",
    description: "Mental and behavioral health billing support for eligibility, authorization, time-based documentation, claims, denials and A/R — inside your existing software.",
    h1: "Mental health billing with the authorization and documentation detail in view.",
    intro: "Behavioral health claims depend on documentation that supports the service, the time and the medical necessity requirements of the payer. Our billing team works with your clinical documentation and existing software to keep those details connected to the claim.",
    image: photo.mentalHealthBillingWorkflow,
    imageAlt: "Counselor speaking with a family in a calm behavioral-health setting",
    sections: [
      { title: "Eligibility and benefits come first", body: "Confirm coverage, member identifiers, behavioral-health benefits, deductibles and visit or authorization requirements before the service. Where a plan requires a referral or prior authorization, the requirement is tracked to the scheduled visit.", points: ["Confirm plan and behavioral-health benefit coverage", "Capture referral and authorization requirements", "Document the information used at scheduling"] },
      { title: "Authorization and visit limits", body: "Authorization units, visit limits and effective dates vary by payer and plan. We track what was approved, what was used and what remains, and flag mismatches before the claim is submitted." },
      { title: "Time-based and service documentation", body: "For services that depend on time or a specific documentation standard, the claim must match the record. We review the encounter documentation available to billing and coordinate with the practice when a detail is unclear.", points: ["Match service and time documentation to the code billed", "Use the payer's current policy for the specific plan", "Keep clinical decisions with the treating provider"] },
      { title: "Telehealth billing considerations", body: "Telehealth coverage and originating-site or modifier requirements change by payer and plan. We verify the current policy for the payer and service rather than applying a universal rule." },
      { title: "Claims, denials and A/R", body: "Denials are reviewed by reason, corrected where supported, appealed inside the payer deadline and tracked. Recurring authorization or documentation issues are fed back to scheduling and clinical teams." },
      { title: "Credentialing and payer enrollment", body: "Behavioral health providers may need separate payer enrollment, group affiliations or site-specific setup. We coordinate the enrollment details and keep the payer directory information current where that work is in scope." },
    ],
    services: ["eligibility-and-benefits-verification", "prior-and-retro-authorization", "denial-management", "accounts-receivable-management", "credentialing-and-contracting"],
    software: ["advancedmd-medical-billing", "eclinicalworks-medical-billing", "tebra-kareo-medical-billing"],
    faqs: [
      { q: "Do you handle prior authorization for therapy services?", a: "Prior authorization and retro authorization can be included in scope. Requirements are checked against the specific payer and plan, not a blanket rule." },
      { q: "Can you work with our existing behavioral-health EHR?", a: "We work within your existing system where access and permissions allow. The onboarding review confirms what billing access is required." },
      { q: "Do you make clinical or medical-necessity decisions?", a: "No. Clinical decisions remain with the treating provider. Billing reviews the documentation available and applies payer requirements to the claim." },
    ],
  },
  {
    slug: "physical-therapy-billing",
    name: "Physical Therapy",
    title: "Physical Therapy Billing Services | Knight Medical Billing",
    description: "Physical therapy billing support for timed services, units, visit limits, plan-of-care documentation, claims, denials and A/R follow-up.",
    h1: "Physical therapy billing that respects the unit — and the documentation behind it.",
    intro: "Physical therapy revenue depends on details that are easy to lose between the treatment room and the claim: timed services, units, plan-of-care dates and payer-specific visit limits. Our billing team keeps those details visible in the workflow.",
    image: photo.physicalTherapyBillingClinic,
    imageAlt: "Physical therapist treating a patient in a rehabilitation clinic",
    sections: [
      { title: "Timed services and units", body: "Timed treatment codes require the documentation and unit calculation to agree. We review what is documented and apply the payer's current unit rules, escalating unclear documentation rather than guessing.", points: ["Review timed service documentation before claim release", "Check unit calculations against the payer policy", "Flag documentation gaps for the treating provider"] },
      { title: "Plan of care and recertification", body: "The plan of care, certification dates and recertification requirements affect whether services are billable. We track the dates that are visible to billing and flag claims that reference an expired or incomplete plan." },
      { title: "Visit limits and authorization", body: "Visit caps, authorization units and effective dates differ by payer. We record what was approved and used, and confirm whether a new authorization is required before the next visit." },
      { title: "Eligibility and benefits", body: "Coverage, deductible, coinsurance and therapy-specific benefit limits are verified before the visit where the workflow allows. The patient's responsibility should be clear before treatment, not after a denial." },
      { title: "Claims, denials and A/R", body: "Claims are reviewed for service, unit and documentation alignment. Denials are categorized by reason, appealed where supported and trended so the practice can correct scheduling and documentation issues." },
      { title: "Payer-specific requirements", body: "Payer policies differ and change. We verify the current requirement for the specific payer and plan rather than applying a generic therapy rule to every claim." },
    ],
    services: ["medical-billing-and-coding", "eligibility-and-benefits-verification", "prior-and-retro-authorization", "denial-management", "accounts-receivable-management"],
    software: ["advancedmd-medical-billing", "eclinicalworks-medical-billing", "nextgen-medical-billing"],
    faqs: [
      { q: "Can you track therapy visit limits?", a: "Yes. We track authorization and visit-limit information that is available to the billing team and flag when the next visit may require a new authorization. Final coverage decisions remain payer-specific." },
      { q: "Do you review timed units?", a: "We review the documentation available to billing against the payer's unit rules and route unclear documentation back to the practice rather than inventing a unit." },
      { q: "Do you handle plan-of-care recertification?", a: "We can track certification and recertification dates that affect billing and flag missing or expired documentation. Clinical certification remains with the treating provider." },
    ],
  },
  {
    slug: "podiatry-billing",
    name: "Podiatry",
    title: "Podiatry Billing Services | Knight Medical Billing",
    description: "Podiatry billing support for routine and surgical care, medical necessity, modifiers, DME/orthotics, claims, denials and A/R follow-up.",
    h1: "Podiatry billing with the routine-versus-medical distinction in focus.",
    intro: "Podiatry claims often turn on distinctions that are easy to blur: routine versus medically necessary foot care, surgical global periods, modifier use and DME or orthotic requirements. Our team reviews those details against the documentation and the payer's current policy.",
    image: photo.podiatryBillingServices,
    imageAlt: "Clinician reviewing a foot X-ray on a tablet",
    sections: [
      { title: "Routine versus medical care", body: "Routine foot care and medically necessary treatment can be billed differently. We review the documentation supporting medical necessity and avoid applying blanket coverage assumptions to every patient or payer." },
      { title: "Surgical care and global periods", body: "Procedure codes, global periods, modifiers and postoperative visits need to align with the operative note and the payer's rules. We flag claims where the documentation and code selection may not match." },
      { title: "Orthotics and DME", body: "When orthotics or DME are part of the service, coverage, documentation and supplier requirements vary. We verify the applicable policy for the payer and plan before assuming reimbursement." },
      { title: "Modifiers and payer requirements", body: "Modifier selection depends on the service and payer policy. We review the claim against the documentation and the payer's current guidance, escalating ambiguity rather than guessing." },
      { title: "Claims, denials and A/R", body: "Claims are reviewed before submission and denials are worked by reason. Recurring documentation, modifier or authorization problems are summarized for the practice so the same claim is not reworked every month." },
      { title: "Eligibility and patient responsibility", body: "Coverage and benefit verification helps the front desk explain what the patient may owe. Eligibility gaps are addressed before the claim rather than after adjudication." },
    ],
    services: ["medical-billing-and-coding", "denial-management", "accounts-receivable-management", "chart-auditing-and-drg-review", "credentialing-and-contracting"],
    software: ["advancedmd-medical-billing", "eclinicalworks-medical-billing", "collaboratemd-medical-billing"],
    faqs: [
      { q: "Do you handle routine foot care claims?", a: "We review the service and documentation against the payer's coverage requirements. We do not assume routine care is covered or excluded across all plans." },
      { q: "Can you support surgical podiatry claims?", a: "Yes. Surgical claims are reviewed against the operative documentation, global-period rules and applicable modifiers, with unclear items routed back to the practice." },
      { q: "Do you manage orthotics or DME billing?", a: "Where that work is in scope, we verify the payer and plan requirements and review the supporting documentation. The exact scope is agreed before onboarding." },
    ],
  },
];

export const buyerGuideArticles: Article[] = [
  {
    slug: "how-to-choose-medical-billing-company",
    title: "How to choose a medical billing company: a practical buyer's guide",
    category: "Choosing a partner",
    excerpt: "A due-diligence guide for practice owners comparing medical billing companies: specialty fit, software compatibility, A/R ownership, reporting, pricing and the questions to ask before signing.",
    image: photo.caseStudiesHealthcareTeam,
    readTime: "10 min read",
    date: "2026-11-10",
    author: "Knight Medical Billing Team",
    body: [
      { paragraphs: ["Choosing a billing company is an operating decision, not a purchasing decision. The right partner changes who owns the daily work and how quickly problems become visible. The wrong one adds another layer of reporting without improving the work underneath."] },
      { heading: "Start with your actual problem", paragraphs: ["Are claims late? Are denials going unworked? Is the front desk overloaded? Is A/R aging because no one owns follow-up? A company that is strong in one area may not fit another. Define the problem and the scope before comparing proposals."] },
      { heading: "Check specialty and payer experience", paragraphs: ["Ask how the team handles your highest-volume codes, your dominant payers and your documentation patterns. General billing experience is not the same as specialty fluency. Ask for a specific example of a workflow problem in your specialty and how they would investigate it."] },
      { heading: "Confirm software compatibility", paragraphs: ["The partner should work in your existing system where access allows, or explain a concrete reason a change is needed. Ask who will have access, how the access is limited, and how claims, payments and notes will remain visible to your practice."] },
      { heading: "Ask how A/R and denials are owned", paragraphs: ["A billing company should be able to describe a worklist, an owner, a follow-up cadence and an escalation path. Ask what happens to a denied claim, who appeals it, how deadlines are tracked and what reporting proves the work was done."] },
      { heading: "Review reporting before you sign", paragraphs: ["Ask for a sample report. It should connect collections, claim acceptance, denials, days in A/R and aged balances to a next action. A dashboard that cannot explain a number is not useful."] },
      { heading: "Understand pricing and contract terms", paragraphs: ["Pricing may be a percentage of collections, a flat fee or another structure. Clarify the basis, minimums, setup charges, additional-service charges, notice periods and what happens to outstanding A/R when the relationship ends. Compare total scope, not just the headline rate."] },
      { heading: "Questions to ask before signing", paragraphs: ["Who owns my A/R? Which software and clearinghouse? Who appeals denials? What reporting do I receive and when? What is the onboarding plan? How do you handle credentialing? What are the termination terms? How is data protected? Who is my named contact?"], list: ["Who is assigned to my account and how do I reach them?", "Which functions are included, and which cost extra?", "How are open claims and existing A/R handled at transition?", "What happens if performance does not meet the agreed scope?", "How is patient data accessed and protected?", "What is the exit process?"] },
      { heading: "Treat the proposal as a scope document", paragraphs: ["The best proposal is specific: functions, access, reporting, cadence, escalation and assumptions. If a company will not put those details in writing, that is useful information. A free consultation should end with clarity, not pressure."] },
    ],
  },
  {
    slug: "in-house-vs-outsourced-medical-billing",
    title: "In-house vs. outsourced medical billing: a neutral comparison",
    category: "Operations",
    excerpt: "Compare in-house and outsourced medical billing across staffing, software, denials, A/R, reporting, management time, scalability, cost and accountability — without one-size-fits-all claims.",
    image: photo.whyKnightTeamCollaboration,
    readTime: "9 min read",
    date: "2026-11-10",
    author: "Knight Medical Billing Team",
    body: [
      { paragraphs: ["There is no universal answer to whether billing should stay in-house or be outsourced. The right model depends on volume, payer mix, internal capability, management bandwidth and the work the practice wants to own. A useful comparison separates the work from the sales pitch."] },
      { heading: "Staffing and continuity", paragraphs: ["An in-house team gives direct control and proximity to the practice. It also creates hiring, training, vacation coverage and turnover risk. An outsourced team can provide continuity, but you need to understand who is actually assigned to your account and how turnover is managed."] },
      { heading: "Billing expertise", paragraphs: ["Billing and coding knowledge has to match the specialty and payer mix. An in-house generalist may be excellent operationally but need support on a complex specialty. An outsourced team should be able to name the coders and collectors assigned to the work."] },
      { heading: "Software and access", paragraphs: ["Both models can work in your existing software. The critical questions are who has access, how it is limited, how work is documented and how the practice retains visibility. A partner that requires a platform migration should be able to justify why."] },
      { heading: "Denials and A/R ownership", paragraphs: ["Denials and A/R are where models are easiest to compare. Ask who works the denial, who appeals it, how timely-filing deadlines are tracked and how aged balances are prioritized. The answer matters more than whether the team sits in your building."] },
      { heading: "Reporting and management time", paragraphs: ["An in-house team may require the practice manager to supervise worklists and reporting. An outsourced partner should reduce that management load, but only if reporting is clear and escalation is real. Ask for the report format and the recurring review cadence."] },
      { heading: "Scalability and cost", paragraphs: ["An in-house team can scale with hiring; an outsourced team can scale with account staffing. Cost comparisons should include salary, benefits, software, training, turnover, management time and the cost of denied or unworked claims. Do not rely on a quoted percentage alone."] },
      { heading: "Accountability", paragraphs: ["The right question is not in-house versus outsourced. It is which model creates the clearest ownership for eligibility, charge review, claims, posting, denials and A/R — and which one your practice can actually manage week to week."] },
    ],
  },
  {
    slug: "medical-billing-pricing",
    title: "How medical billing pricing works: structures to compare",
    category: "Pricing",
    excerpt: "An educational guide to common medical billing pricing structures — percentage of collections, flat fees, minimums, setup charges and contract considerations — without invented company rates.",
    image: photo.medicalBillingPricingCalculator,
    readTime: "8 min read",
    date: "2026-11-10",
    author: "Knight Medical Billing Team",
    body: [
      { paragraphs: ["Medical billing pricing is usually presented as a single number, but the number only makes sense in context. Scope, volume, specialty, payer mix, software access and the state of the existing A/R all affect what a company can responsibly quote."] },
      { heading: "Percentage of collections", paragraphs: ["A percentage-of-collections arrangement ties the fee to money collected. That can align incentives, but you need to know the exact definition of collections, how patient payments and refunds are treated, whether the percentage changes by volume and what happens to old A/R. Ask for a worked example using your numbers."] },
      { heading: "Flat fee", paragraphs: ["A flat monthly fee can make budgeting easier and may suit a practice with predictable volume. The tradeoff is that the fee may not flex with growth or seasonality. Clarify what happens when volume increases, a new provider joins or a large clean-up project is required."] },
      { heading: "Per-claim or per-service arrangements", paragraphs: ["Some arrangements charge per claim, per encounter or per service. These can be transparent at low volume but need careful comparison at scale. Ask whether rejections, corrected claims and appeals count as additional claims, and how the fee changes when a claim is reworked."] },
      { heading: "Minimums, setup fees and extras", paragraphs: ["A low headline rate can hide minimum monthly fees, implementation charges, clearinghouse fees, credentialing fees, reporting charges or charges for old A/R cleanup. Ask for the complete fee schedule in writing and compare the total expected cost for your scope."] },
      { heading: "Contract terms that affect cost", paragraphs: ["Notice periods, auto-renewal, termination assistance, ownership of data and responsibility for outstanding A/R all affect the true cost of switching. A low rate with a difficult exit can be more expensive than a clearer arrangement."] },
      { heading: "What to ask for in a quote", paragraphs: ["Ask for the pricing basis, inclusions, exclusions, minimums, setup fees, reporting, onboarding responsibilities and termination terms. Ask what is not included. A practice-specific quote should follow a review of your claims, A/R, software and payer mix, not a generic brochure."], list: ["What is the exact definition of collections?", "Are patient payments, refunds and credits treated differently?", "Do rejections, appeals and corrected claims count as additional volume?", "Is old A/R cleanup included or priced separately?", "What happens if volume or provider count changes?", "What are the notice and transition terms?"] },
      { heading: "Do not compare a percentage to a salary", paragraphs: ["A billing percentage and an in-house salary are not directly comparable. The in-house cost includes benefits, management, software, training and turnover; the outsourced cost may include minimums and implementation. Compare total scope and risk, not just the largest number on the page."] },
    ],
  },
];
