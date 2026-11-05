export const site = {
  name: "Knight Medical Billing",
  shortName: "Knight",
  abbreviation: "KMB",
  logo: "/images/knight-mark.png",
  logoWhite: "/images/knight-mark-white.png",
  tagline: "Custom tailored medical billing services.",
  description:
    "Knight Medical Billing is a custom tailored medical billing and revenue cycle management company serving hospitals, healthcare systems, emergency rooms, urgent cares and private practices. 99.9% claim acceptance rate, 24-hour claim filing, no prepayment and no hidden fees.",
  phone: "(812) 994-0046",
  phoneRaw: "8129940046",
  phoneHref: "tel:+18129940046",
  email: "admin@knightmedicalbilling.com",
  support: "24/5 multilingual support",
  address: "585 Grove St Ste 145, Herndon, VA 20170-4790, USA",
  addressShort: "Herndon, Virginia",
  hours: "Mon – Fri: 8:00 AM – 5:00 PM ET · Sat–Sun: Closed",
  claimAcceptance: "99.9%",
  filingWindow: "24 hours",
  founded: 2023,
  experience: "25 years",
  socials: {
    instagram: "https://www.instagram.com/knight_medical_billing/",
    facebook: "https://www.facebook.com/profile.php?id=61582608834344",
    linkedin: "https://www.linkedin.com/company/knight-medical-billing",
  },
  mapEmbed:
    "https://www.google.com/maps?q=585+Grove+St+Ste+145,+Herndon,+VA+20170-4790&hl=en&z=15&output=embed",
  mapLink: "https://www.google.com/maps/search/?api=1&query=585+Grove+St+Ste+145,+Herndon,+VA+20170-4790",
  url: process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://www.knightmedicalbilling.com",
};

export type NavChild = { label: string; href: string; description?: string; icon?: string };
export type NavColumn = { title: string; items: NavChild[] };
export type NavItem = { label: string; href: string; columns?: NavColumn[]; children?: NavChild[] };

export const primaryNav: NavItem[] = [
  {
    label: "Services",
    href: "/services",
    columns: [
      {
        title: "Revenue cycle",
        items: [
          { label: "Medical Billing", href: "/services/medical-billing-and-coding", description: "Charge capture to paid claim", icon: "ReceiptText" },
          { label: "Revenue Cycle Management", href: "/services/complete-rcm-services", description: "The whole cycle, one team", icon: "Workflow" },
          { label: "Claims Management", href: "/services/claims-management", description: "Scrubbed, filed, tracked", icon: "FileCheck2" },
          { label: "Payment Posting", href: "/services/payment-posting", description: "ERAs posted and reconciled", icon: "CircleDollarSign" },
          { label: "Accounts Receivable", href: "/services/accounts-receivable-management", description: "Follow-up on every balance", icon: "TrendingUp" },
          { label: "Denial Management", href: "/services/denial-management", description: "Appeals and prevention", icon: "ShieldAlert" },
        ],
      },
      {
        title: "Access & enrollment",
        items: [
          { label: "Eligibility & Benefits", href: "/services/eligibility-and-benefits-verification", description: "Verify before the visit", icon: "ShieldCheck" },
          { label: "Prior Authorization", href: "/services/prior-and-retro-authorization", description: "Approvals tracked to expiry", icon: "ClipboardCheck" },
          { label: "Credentialing", href: "/services/credentialing-and-contracting", description: "In-network, on time", icon: "BadgeCheck" },
          { label: "Contracting & Enrollment", href: "/services/contracting-and-enrollment", description: "Payer applications managed", icon: "Handshake" },
          { label: "EFT, ERA & EDI Support", href: "/services/eft-era-edi-support", description: "Electronic plumbing", icon: "Network" },
          { label: "Performance Reporting", href: "/services/revenue-performance-reporting", description: "Metrics with actions", icon: "LineChart" },
        ],
      },
      {
        title: "Specialist support",
        items: [
          { label: "Out-of-Network Negotiation", href: "/services/out-of-network-negotiation", description: "Multiplan, Zelis, Viant, GCS", icon: "Handshake" },
          { label: "Patient Billing", href: "/services/complete-patient-billing", description: "Statements and patient calls", icon: "Wallet" },
          { label: "Clean-Up Billing", href: "/services/clean-up-billing", description: "Find the revenue leak", icon: "Wrench" },
          { label: "Chart Auditing & DRG", href: "/services/chart-auditing-and-drg-review", description: "Coding accuracy review", icon: "Microscope" },
        ],
      },
    ],
  },
  {
    label: "Specialties",
    href: "/specialties",
    columns: [
      {
        title: "By specialty",
        items: [
          { label: "Cardiology", href: "/specialties/cardiology", description: "Diagnostics and devices", icon: "HeartPulse" },
          { label: "Orthopedics", href: "/specialties/orthopedic", description: "Global periods and implants", icon: "Bone" },
          { label: "Behavioral Health", href: "/specialties/behavioral-health", description: "Time-based and parity", icon: "HandHeart" },
          { label: "Gastroenterology", href: "/specialties/gastroenterology", description: "Screening vs. diagnostic", icon: "Search" },
          { label: "Radiology", href: "/specialties/radiology", description: "Technical and professional", icon: "ScanLine" },
          { label: "Urgent Care", href: "/specialties/urgent-care", description: "High-volume E/M", icon: "Cross" },
        ],
      },
      {
        title: "Practice settings",
        items: [
          { label: "Private Practices", href: "/who-we-serve/private-practices", description: "Independent practice support", icon: "Stethoscope" },
          { label: "Hospitals", href: "/who-we-serve/hospitals", description: "Hospital billing and A/R", icon: "Cross" },
          { label: "Healthcare Systems", href: "/who-we-serve/healthcare-systems", description: "Multi-facility RCM", icon: "Building2" },
          { label: "Emergency Rooms", href: "/who-we-serve/emergency-rooms", description: "High-acuity ED billing", icon: "Siren" },
          { label: "Urgent Cares", href: "/who-we-serve/urgent-cares", description: "Volume and speed", icon: "Activity" },
        ],
      },
    ],
  },
  {
    label: "Resources",
    href: "/insights",
    children: [
      { label: "Insights & guides", href: "/insights", description: "Billing playbooks from our team", icon: "Newspaper" },
      { label: "Results & performance", href: "/results", description: "How we measure the work", icon: "LineChart" },
      { label: "Frequently asked questions", href: "/faq", description: "Answers before you switch", icon: "CircleDollarSign" },
      { label: "Why pay for paid", href: "/services/complete-rcm-services", description: "How engagement pricing works", icon: "ReceiptText" },
      { label: "HIPAA & data security", href: "/hipaa-compliance", description: "Safeguards and agreements", icon: "ShieldCheck" },
      { label: "Patient billing rights", href: "/services/complete-patient-billing", description: "Statements and support", icon: "Wallet" },
    ],
  },
  {
    label: "Company",
    href: "/about",
    children: [
      { label: "About us", href: "/about", description: "Mission, values and leadership", icon: "Building2" },
      { label: "Who we serve", href: "/who-we-serve", description: "Facilities we support", icon: "Building2" },
      { label: "Our process", href: "/our-process", description: "Onboarding and workflow", icon: "Workflow" },
      { label: "Results", href: "/results", description: "Metrics we report monthly", icon: "BarChart3" },
      { label: "Contact", href: "/contact", description: "Talk to our team", icon: "Phone" },
    ],
  },
  { label: "Contact", href: "/contact" },
];

export const heroPromises = [
  { title: "5 Days Process", detail: "Fast & easy onboarding", icon: "Zap" },
  { title: "No Prepayment", detail: "No hidden fees", icon: "Wallet" },
  { title: "24/5 Support", detail: "Multilingual support", icon: "Headphones" },
  { title: "99.9% Acceptance", detail: "Claim acceptance rate", icon: "BadgeCheck" },
];

export const kpis = [
  { value: "99.9%", label: "Claim acceptance rate", detail: "Clean claims built carefully, looking for errors before submission." },
  { value: "24 hrs", label: "Claim filing window", detail: "All claims filed within 24 hours of charge entry." },
  { value: "10%", label: "Revenue uplift", detail: "We routinely boost client revenue by at least 10%." },
  { value: "20%", label: "Higher reimbursements", detail: "Hospitals and systems we support raise reimbursement by 20%+." },
  { value: "5 days", label: "Go-live process", detail: "A fast, easy onboarding with no prepayment required." },
  { value: "25 yrs", label: "Combined experience", detail: "Certified billers and coders across every major specialty." },
];

export type Service = {
  slug: string;
  name: string;
  short: string;
  tagline: string;
  icon: string;
  image: string;
  intro: string;
  bullets: string[];
  metrics: { value: string; label: string }[];
  highlights: { title: string; detail: string }[];
  included: string[];
  faqs: { q: string; a: string }[];
};

export const services: Service[] = [
  {
    slug: "medical-billing-and-coding",
    name: "Medical Billing & Coding",
    short: "Medical billing & coding",
    tagline: "The keystone of your financial performance.",
    icon: "ReceiptText",
    image: "/images/photos/documents-team.jpg",
    intro:
      "The single most important element to guarantee reimbursements is proper medical billing and coding. Even the smallest mistake can delay payment. Our dedicated team of billers and coders makes sure patients and payers reimburse your facility for the services you deliver.",
    bullets: ["Certified billers and coders", "CPT, ICD-10-CM and E/M coding", "Claims filed within 24 hours", "Denials and appeals handled"],
    metrics: [
      { value: "99.9%", label: "Claim acceptance" },
      { value: "24 hrs", label: "Claim filing" },
      { value: "25 yrs", label: "Combined experience" },
    ],
    highlights: [
      {
        title: "Choose us to keep your billing on track",
        detail:
          "We provide cutting-edge medical billing and coding services to medical offices and facilities of all sizes. We routinely boost client revenue by at least 10% while making the billing process efficient, compliant and stress-free.",
      },
      {
        title: "Certified coding across specialties",
        detail:
          "Our coders hold Certified Professional Coder and Certified Inpatient Coder credentials, with working exposure to specialty clinics, emergency rooms, urgent cares, hospitals and healthcare systems. Their competence covers ICD-10-CM, evaluation and management codes and CPT coding for all specialty training areas.",
      },
      {
        title: "Full-cycle follow-through",
        detail:
          "We handle routine claim submissions, accounts receivable management, follow-ups, denials and appeals on your behalf as your medical billing and coding company — so your staff can stay with patients.",
      },
    ],
    included: [
      "Certified professional and inpatient coders",
      "ICD-10-CM, CPT and E/M level coding",
      "Charge entry and demographics accuracy",
      "Claim scrubbing before submission",
      "Claims filed within 24 hours",
      "Denial management and appeals",
      "Accounts receivable follow-up",
      "Real-time reporting",
      "HIPAA-compliant data handling",
      "Specialty-specific coding support",
    ],
    faqs: [
      { q: "What certifications do your coders hold?", a: "Our team includes Certified Professional Coders (CPC) and Certified Inpatient Coders (CIC), with coding experience across specialty clinics, emergency rooms, urgent cares, hospitals and healthcare systems." },
      { q: "How quickly are claims filed?", a: "Claims for practices are filed within 24 hours. Our claim acceptance rate is 99.9%." },
      { q: "Do you work in my billing software?", a: "Yes. We work in Collaborated, Medisoft, Medical Manager, DocuTap-Experity, eClinicalWorks, NextGen, AdvancedMD, Kareo, GoRev, Elligence and other major platforms." },
    ],
  },
  {
    slug: "accounts-receivable-management",
    name: "Accounts Receivable Management",
    short: "Accounts receivable management",
    tagline: "Chase every unpaid dollar — not just the easy ones.",
    icon: "TrendingUp",
    image: "/images/photos/documents-review.jpg",
    intro:
      "We aggressively manage your practice's accounts receivable by pinpointing outstanding payments the provider or facility should expect, then pursuing the patient or payor for the unpaid balance. Payments are posted in a timely manner to keep billing optimal.",
    bullets: ["A/R follow-up by aging bucket", "Denial investigation and reopening", "Underpaid claim appeals", "Timely payment posting"],
    metrics: [
      { value: "A/R", label: "Aged claim recovery" },
      { value: "180+", label: "Days outstanding targeted" },
      { value: "Daily", label: "Follow-up cadence" },
    ],
    highlights: [
      {
        title: "Why A/R follow-up is essential",
        detail:
          "A/R follow-up teams investigate denied claims and reopen them to recover the maximum payment from insurance companies. In-house billing and RCM is largely a thing of the past — specific skill sets are now required to handle follow-up properly.",
      },
      {
        title: "A dedicated team, not a spare desk",
        detail:
          "Our A/R program overcomes the problems that delay individual providers' collection efforts. We assign a full team dedicated to resolving unpaid claims in the minimum possible time, staffed by collectors with years of medical coding and collections experience.",
      },
      {
        title: "Built to find revenue leakage",
        detail:
          "We transform end-to-end receivables management by optimizing cash flow, lowering past-due receivables and identifying revenue leakage and refilling the gaps. We look over ERAs and scanned EOBs to make sure every payment detail reaches the patient account.",
      },
    ],
    included: [
      "Full A/R review and prioritization",
      "Aged claim follow-up and escalation",
      "Denial investigation and reopening",
      "Underpayment identification and appeals",
      "ERA and EOB payment posting",
      "Patient balance follow-up",
      "Revenue leakage analysis",
      "Refund and credit balance review",
      "A/R reporting by age and payer",
      "Dedicated collection team per client",
    ],
    faqs: [
      { q: "Do you work old A/R that we have written off?", a: "Yes. We audit outstanding balances, identify what is still collectible and pursue payers and patients while keeping you informed at every step." },
      { q: "How do you prevent A/R from growing again?", a: "Follow-up is only half of it. We identify the source of the leakage and build process fixes so the same denial or underpayment does not recur." },
      { q: "Who handles patient calls about statements?", a: "We do — complete patient billing covers statements, collections and patient questions, giving patients a direct line to us." },
    ],
  },
  {
    slug: "complete-rcm-services",
    name: "Complete RCM Services",
    short: "Complete RCM services",
    tagline: "From the moment your patient walks in until payment is received.",
    icon: "Workflow",
    image: "/images/photos/analytics-laptop.jpg",
    intro:
      "Knight Medical Billing offers complete revenue cycle management, from the moment your patient walks in the door until payment for your services is received. We can manage and educate your staff on compliance, streamline workflow and maximize productivity.",
    bullets: ["Staff training in scheduling and registration", "Clean claim construction", "Patient statements and calls", "Reporting that tells the truth"],
    metrics: [
      { value: "99.9%", label: "Claim acceptance" },
      { value: "24 hrs", label: "Claim filing" },
      { value: "24/5", label: "Support coverage" },
    ],
    highlights: [
      {
        title: "An extension of your staff",
        detail:
          "We train your staff in patient scheduling and registration, checking insurance eligibility, copayment and deductible collection and better charting practices. Then we build a clean claim, carefully looking for errors before it leaves the building.",
      },
      {
        title: "Every step, owned",
        detail:
          "We handle claim management, send statements to patients, answer patient calls and provide reports — making revenue cycle management and practice management efficient and accessible for your team.",
      },
      {
        title: "Process discipline that raises revenue",
        detail:
          "Our RCM approach pairs accurate eligibility verification and authorization with coding accuracy and clean claim construction. That is how we hold a 99.9% claim acceptance rate and help clients lift revenue by at least 10%.",
      },
    ],
    included: [
      "Patient scheduling and registration training",
      "Insurance eligibility and benefits checks",
      "Copay and deductible collection support",
      "Charting best-practice coaching",
      "Coding and clean claim construction",
      "Claim submission within 24 hours",
      "Denial management and appeals",
      "Patient statements and phone support",
      "Refunds and credit balance handling",
      "Management reporting and feedback",
    ],
    faqs: [
      { q: "What does complete RCM include?", a: "Scheduling and registration support, eligibility and authorization, coding, clean claim construction, submission, payment posting, denials, appeals, patient statements, refunds and reporting." },
      { q: "Will you train our front office?", a: "Yes. We train on scheduling, registration, eligibility, copay and deductible collection and charting practices as part of the engagement." },
      { q: "How do we track performance?", a: "You receive accessible, real-time data on your revenue cycle so you always know what is happening and where changes can be made." },
    ],
  },
  {
    slug: "credentialing-and-contracting",
    name: "Credentialing & Contracting",
    short: "Credentialing & contracting",
    tagline: "Build your practice on healthy payer relationships.",
    icon: "BadgeCheck",
    image: "/images/photos/stethoscope-notes.jpg",
    intro:
      "Credentialing and contracting are the basis of starting a clinic or healthcare facility, and they lay the foundation for your relationships with insurance companies and patients. We obtain and negotiate contracts with insurance payors and keep your agreements current.",
    bullets: ["Provider enrollment and credentialing", "In-network contract negotiation", "Contract maintenance and updates", "Reimbursement rate review"],
    metrics: [
      { value: "25 yrs", label: "Relationship experience" },
      { value: "EDI", label: "Payer network contacts" },
      { value: "Up to date", label: "Contract tracking" },
    ],
    highlights: [
      {
        title: "Importance of insurance credentialing",
        detail:
          "Being in the right networks, with contracts that benefit you, increases patient care and satisfaction as well as revenue. Our credentialing services help your facility serve a larger pool of patients while protecting your reimbursement.",
      },
      {
        title: "Negotiating in-network contracts",
        detail:
          "Effective contract negotiation is the first step in growing your facility. We are aggressive in negotiations, and relationships spanning over twenty-five years have consistently benefited our clients. We enroll providers in both government and private insurance networks.",
      },
      {
        title: "Understanding the fine print",
        detail:
          "Understanding contracts is key to maximizing reimbursement. We handle reimbursement definitions, healthcare delivery arrangements and the negotiations that result in the best rates — while keeping every agreement up to date.",
      },
    ],
    included: [
      "Individual and group provider enrollment",
      "Government and private network applications",
      "Contract negotiation support",
      "Rate review and benchmarking",
      "Contract expiration tracking",
      "CAQH and provider data maintenance",
      "Revalidation support",
      "EDI and ERA setup coordination",
      "Documentation collection",
      "Payer follow-up and escalation",
    ],
    faqs: [
      { q: "Which payers do you work with?", a: "Government and commercial payers including large national carriers such as Blue Cross Blue Shield, UnitedHealth Group, Humana, Anthem, Aetna and Cigna, plus regional and managed-care plans." },
      { q: "Can you renegotiate our existing contracts?", a: "Yes. We review current rates, benchmark against your locality and patient volumes, and negotiate where there is room to improve." },
      { q: "Do you handle revalidations?", a: "Yes. We keep credentials and payer contracts current so billing does not stop because something expired." },
    ],
  },
  {
    slug: "out-of-network-negotiation",
    name: "Out-of-Network Negotiation",
    short: "Out-of-network negotiation",
    tagline: "The trickiest billing in the industry. Our specialty.",
    icon: "Handshake",
    image: "/images/photos/documents-desk.jpg",
    intro:
      "Negotiating out-of-network claims is critical for hospitals and free-standing emergency rooms. Our negotiation and settlement team has decades of expertise in medical billing, coding and RCM, and we negotiate directly with pricing vendors such as Multiplan, Zelis and Viant.",
    bullets: ["Pre-payment and post-payment negotiation", "Multiplan, Zelis, Viant and GCS claims", "OON database of underpaid claims", "Underpaid appeal support"],
    metrics: [
      { value: "10+ yrs", label: "Vendor navigation" },
      { value: "Pre & post", label: "Payment negotiation" },
      { value: "OON", label: "Proprietary database" },
    ],
    highlights: [
      {
        title: "We know their tactics",
        detail:
          "Insurance companies and their negotiation vendors use benefit limitations to minimize reimbursement. Our team knows their terminology and the negotiation practices that recover the best rates for your facility.",
      },
      {
        title: "Analysis before negotiation",
        detail:
          "We protect your patients by analyzing historical data for your locality and negotiating from that analysis — so families are not left with massive out-of-pocket expense and your facility recovers what it deserves.",
      },
      {
        title: "Pre-payment and post-payment",
        detail:
          "We handle settlement offers received before reimbursement, and we re-open claims that were priced by a vendor after payment. Over 10 years of pre- and post-payment negotiation built our proprietary OON database that flags underpaid claims.",
      },
    ],
    included: [
      "Out-of-network claim review",
      "Settlement offer evaluation",
      "Negotiation with Multiplan, Zelis, Viant, GCS",
      "Pre-payment negotiation",
      "Post-payment re-negotiation",
      "Underpaid claim appeals",
      "Limited-benefit policy identification",
      "Employer preference review",
      "Locality-based rate analysis",
      "Patient balance protection",
    ],
    faqs: [
      { q: "What is pre-payment negotiation?", a: "It is negotiating the settlement offer a pricing vendor proposes on behalf of the insurer before the claim is reimbursed." },
      { q: "And post-payment?", a: "Post-payment applies when the insurer has already reimbursed using a vendor's pricing. We re-open the claim and negotiate a better rate." },
      { q: "Do you work with free-standing ERs?", a: "Yes — out-of-network negotiation is especially valuable for hospitals and free-standing emergency rooms." },
    ],
  },
  {
    slug: "eligibility-and-benefits-verification",
    name: "Eligibility & Benefits Verification",
    short: "Eligibility & benefits verification",
    tagline: "Verify coverage before the visit, not after the denial.",
    icon: "ShieldCheck",
    image: "/images/photos/reception.jpg",
    intro:
      "Eligibility and benefits verification is the first and most critical step in billing. We confirm insurance coverage, authorization requirements, deductibles and copays before your patient is seen — protecting your cash flow and your patient experience.",
    bullets: ["Primary and secondary coverage checks", "Copay, deductible and coinsurance", "Authorization requirement review", "Insurance discovery for self-pay"],
    metrics: [
      { value: "Real-time", label: "Eligibility checks" },
      { value: "Fewer", label: "Eligibility denials" },
      { value: "Higher", label: "Self-pay revenue" },
    ],
    highlights: [
      {
        title: "The first step in the revenue cycle",
        detail:
          "Failure to validate eligibility and obtain prior authorization results in delayed payments and denials, lowering collections. We verify primary and secondary coverage, member and group IDs, coverage dates, copay, deductible, coinsurance and benefit details.",
      },
      {
        title: "Workflow that fits your practice",
        detail:
          "Requests reach us through your scheduling system, EDI, fax, email or FTP. We communicate with payers through web portals, IVR or live calls, resolve missing or incorrect data right away and confirm treatment authorization from the right sources.",
      },
      {
        title: "Boost self-pay revenue",
        detail:
          "We link self-paid patients with managed Medicaid databases to identify coverage patients may not know they have — classifying and filing claims so eligible patients are not carrying costs they should not owe.",
      },
    ],
    included: [
      "Insurance eligibility verification",
      "Primary and secondary coverage confirmation",
      "Member ID, group ID and coverage dates",
      "Deductible, copay and coinsurance calculation",
      "Authorization and referral requirement checks",
      "Missing data identification and resolution",
      "Insurance discovery for self-pay patients",
      "Payer portal and IVR communication",
      "Verification reports before each visit",
      "Full HIPAA compliance and data security",
    ],
    faqs: [
      { q: "When is eligibility verified?", a: "Before the visit. Eligibility responses are sent through your preferred channel so your team has the details at check-in." },
      { q: "Can you find coverage for self-pay patients?", a: "Yes. We check managed Medicaid databases to identify coverage and file claims on the patient's behalf where appropriate." },
      { q: "Does this reduce denials?", a: "It prevents the eligibility-related denials that make up a large share of front-end rejections, and it improves patient satisfaction at check-in." },
    ],
  },
  {
    slug: "prior-and-retro-authorization",
    name: "Prior & Retro Authorization",
    short: "Prior & retro authorization",
    tagline: "The laborious part of billing, handled by specialists.",
    icon: "ClipboardCheck",
    image: "/images/photos/doctors-discussing.jpg",
    intro:
      "Prior and retro authorization is one of the most difficult tasks a practice must take on — laborious, challenging and expensive in staff time. Our authorization specialists submit, track and follow up so approvals do not hold up your care or your cash.",
    bullets: ["Prior authorization submission", "Retro authorization support", "Payer requirement checks", "Authorization tracking to expiry"],
    metrics: [
      { value: "Specialists", label: "Dedicated authorization team" },
      { value: "Tracked", label: "Every open authorization" },
      { value: "Less", label: "Staff time consumed" },
    ],
    highlights: [
      {
        title: "Take the process off your front office",
        detail:
          "Authorization work consumes office time and resources. We manage submission, documentation and payer follow-up so your team can focus on patients instead of hold music.",
      },
      {
        title: "Retro authorizations handled",
        detail:
          "When a service is already delivered, we pursue retro authorization with the documentation the payer requires, helping recover claims that would otherwise be denied.",
      },
      {
        title: "Authorization visibility",
        detail:
          "We track each authorization against the scheduled service and the filed claim, flagging mismatches before they become denials for missing or invalid authorization.",
      },
    ],
    included: [
      "Prior authorization submission",
      "Retro authorization requests",
      "Payer requirement research",
      "Clinical documentation coordination",
      "Authorization status follow-up",
      "Tracking to expiration",
      "CPT and unit matching",
      "Denial prevention for auth gaps",
      "Referral management support",
      "Reporting on authorization status",
    ],
    faqs: [
      { q: "Do you handle retro authorizations?", a: "Yes. When the service has already been delivered, we pursue retro authorization with supporting documentation." },
      { q: "Who communicates with the payer?", a: "Our authorization specialists do, using the payer's required channel, and keep you updated on status." },
      { q: "Does this work alongside eligibility verification?", a: "Yes — eligibility and authorization work together to prevent front-end denials." },
    ],
  },
  {
    slug: "complete-patient-billing",
    name: "Complete Patient Billing",
    short: "Complete patient billing",
    tagline: "Excellent customer service for your patients.",
    icon: "Wallet",
    image: "/images/photos/keyboard.jpg",
    intro:
      "Keep your focus on treating patients while we handle your complete patient billing cycle — mailing statements, collecting dues and answering patient questions. Your patients get a direct line to us, and your staff get their time back.",
    bullets: ["Patient statements and billing", "Patient phone support", "Collection follow-up", "Copay and balance resolution"],
    metrics: [
      { value: "Direct", label: "Patient communication line" },
      { value: "Saved", label: "Front-office hours" },
      { value: "Better", label: "Patient satisfaction" },
    ],
    highlights: [
      {
        title: "Your patients have a direct line",
        detail:
          "Patients can ask us about their statements directly. That saves your employees valuable time that is better spent ensuring better patient care.",
      },
      {
        title: "Clear statements, respectful follow-up",
        detail:
          "We send statements and follow up on balances in a professional, compliant manner, coordinating with payers first so patients are only billed what they actually owe.",
      },
      {
        title: "Fewer surprises at the desk",
        detail:
          "Because eligibility and benefits are verified up front, your team collects the right copay and deductible — reducing overcharging, refunds and the trust issues that follow.",
      },
    ],
    included: [
      "Patient statement generation and mailing",
      "Patient phone support and inquiries",
      "Balance follow-up and reminders",
      "Copay and deductible collection support",
      "Payment plan coordination",
      "Refund and credit balance handling",
      "Insurance-first balance resolution",
      "Patient responsibility review",
      "Account notes and documentation",
      "Coordination with your front office",
    ],
    faqs: [
      { q: "Will patients call you or us?", a: "Patients get a direct line to our team for statement questions. We can route clinical or scheduling questions back to your office." },
      { q: "Do you handle refunds?", a: "Yes. Refunds and credit balances are reviewed and handled as part of the billing cycle." },
      { q: "Is patient outreach compliant?", a: "Yes — all communication is handled under HIPAA requirements with respectful, professional scripting." },
    ],
  },
  {
    slug: "clean-up-billing",
    name: "Clean-Up Billing",
    short: "Clean-up billing",
    tagline: "The clean-up billers who find where the money went.",
    icon: "Wrench",
    image: "/images/photos/desk-charts.jpg",
    intro:
      "For a practice in trouble, we offer an audit of your revenue cycle. Knight Medical Billing is known as the clean-up billers — we find the source of the problems impacting revenue, often within the first day of auditing, then build a plan to prevent it recurring.",
    bullets: ["Revenue cycle audit", "Root-cause identification", "Recovery and resubmission", "Prevention plan"],
    metrics: [
      { value: "First day", label: "Common diagnosis time" },
      { value: "Root cause", label: "Not just symptoms" },
      { value: "Plan", label: "To prevent recurrence" },
    ],
    highlights: [
      {
        title: "We find the source",
        detail:
          "Clean-up billing is not just about working the backlog. We identify why the backlog exists — documentation, coding, eligibility, posting or follow-up — and address the cause.",
      },
      {
        title: "Often diagnosed within a day",
        detail:
          "Any error found during auditing is often tied to documentation and recovered within the first day of auditing. Our team quickly assesses what is hurting revenue and improves it immediately.",
      },
      {
        title: "Prevention built in",
        detail:
          "As your financial partners we identify the issue, develop a plan and put controls in place so the same leak does not return next quarter.",
      },
    ],
    included: [
      "Revenue cycle audit and diagnosis",
      "A/R and denial backlog review",
      "Coding and documentation review",
      "Eligibility and authorization check",
      "Payment posting review",
      "Claim resubmission and appeals",
      "Process correction plan",
      "Staff training recommendations",
      "Recovery reporting",
      "Ongoing monitoring",
    ],
    faqs: [
      { q: "How fast can you find the problem?", a: "Often within the first day of auditing the revenue cycle. We then share a plan to prevent it from happening again." },
      { q: "Is this only for new clients?", a: "No. Existing clients also use clean-up audits when a new provider, location or payer is added." },
      { q: "What if the issue is documentation?", a: "We provide documentation feedback and training recommendations so claims can be supported correctly going forward." },
    ],
  },
  {
    slug: "chart-auditing-and-drg-review",
    name: "Chart Auditing & DRG Review",
    short: "Chart auditing & DRG review",
    tagline: "Better accuracy means better results.",
    icon: "Microscope",
    image: "/images/photos/laptop-notes.jpg",
    intro:
      "Maximize your returns and reduce accounts receivable with a team that ensures proper coding and adherence to regulations and each insurance company's unique rules. Chart auditing keeps documentation accurate and compliant in a constantly changing coding world.",
    bullets: ["Comprehensive chart audits", "Inpatient DRG review", "Coding compliance checks", "Documentation improvement feedback"],
    metrics: [
      { value: "DRG", label: "Inpatient review" },
      { value: "Compliance", label: "Payer rule adherence" },
      { value: "Accuracy", label: "Lower A/R" },
    ],
    highlights: [
      {
        title: "Chart auditing protects revenue",
        detail:
          "Chart auditing is a crucial part of any clinic or healthcare business, ensuring charts are accurate and compliant with complex and fluctuating billing and coding rules.",
      },
      {
        title: "DRG review for inpatient accuracy",
        detail:
          "For inpatient work, our reviewers validate DRG assignment against documentation — recovering appropriate reimbursement and reducing audit exposure at the same time.",
      },
      {
        title: "Education, not just findings",
        detail:
          "Audit results are shared with providers as clear, specific feedback so documentation improves and the same findings do not repeat on the next review.",
      },
    ],
    included: [
      "Comprehensive chart audits",
      "Inpatient DRG review",
      "CPT, ICD-10 and E/M validation",
      "Medical necessity documentation review",
      "Payer-specific rule checks",
      "Coding compliance reporting",
      "Provider feedback sessions",
      "Modifier review",
      "Audit trail documentation",
      "Ongoing monitoring plan",
    ],
    faqs: [
      { q: "How often should charts be audited?", a: "We recommend a baseline audit plus ongoing sampling for new providers and high-risk specialties, with feedback shared after each review." },
      { q: "Do you audit inpatient DRGs?", a: "Yes — DRG review is part of our audit services for hospitals and healthcare systems." },
      { q: "Will you train our providers?", a: "Yes. Findings are translated into practical documentation guidance for your providers." },
    ],
  },
  {
    slug: "denial-management",
    name: "Denial Management",
    short: "Denial management",
    tagline: "Stop losing revenue to preventable denials.",
    icon: "ShieldAlert",
    image: "/images/photos/support-desk.jpg",
    intro:
      "Denials are the most expensive kind of rework in a practice. We investigate every denial, correct the underlying cause, appeal within payer deadlines and feed each root cause back into your front end so the same denial stops recurring.",
    bullets: ["CARC and RARC root-cause analysis", "Payer-specific appeal preparation", "Deadline and timely-filing tracking", "Front-end prevention feedback"],
    metrics: [
      { value: "Every", label: "Denial reviewed" },
      { value: "Tracked", label: "Appeal deadlines" },
      { value: "Closed loop", label: "Root-cause feedback" },
    ],
    highlights: [
      {
        title: "A denial is a symptom, not a task",
        detail:
          "Most practices work denials as a backlog. We treat each one as diagnostic information: why was it denied, which team owns the cause, and what change prevents the next one? That is how denial volume falls instead of simply being re-worked.",
      },
      {
        title: "Appeals written to the payer's rules",
        detail:
          "Our team keeps payer-specific playbooks covering medical-necessity language, documentation requirements and review escalation. Appeals are prepared with the clinical records attached and tracked through to a determination.",
      },
      {
        title: "Reporting you can act on",
        detail:
          "You receive denial reasons grouped by payer, provider and procedure, with the dollar value attached. That ranking tells you which fix is worth doing first — and lets you verify the fix worked.",
      },
    ],
    included: [
      "Full denial backlog review",
      "CARC and RARC categorisation",
      "Payer-specific appeal letters",
      "Medical-necessity documentation packets",
      "Timely-filing deadline tracking",
      "Corrected claim resubmission",
      "Provider feedback on recurring denials",
      "Front-end edit recommendations",
      "Denial trend reporting",
      "Write-off review with your approval",
    ],
    faqs: [
      { q: "How far back can you appeal denials?", a: "It depends on each payer's filing limit. During a backlog review we identify which denials are still within appeal windows and prioritise those first." },
      { q: "Do you handle medical-necessity denials?", a: "Yes. We assemble documentation packets, request review when available, and escalate where the payer offers a next level of appeal." },
      { q: "Will you fix the upstream cause?", a: "That is the point. Every recurring denial should end in an edit, a workflow change or provider training that you can verify in the reporting." },
    ],
  },
  {
    slug: "claims-management",
    name: "Claims Management",
    short: "Claims management",
    tagline: "Every claim scrubbed, filed on time and tracked to payment.",
    icon: "FileCheck2",
    image: "/images/photos/team-tablet.jpg",
    intro:
      "A claim only earns money if it is clean at submission and followed until the payer pays. We manage the full claim lifecycle in your existing software — from charge entry and scrubbing to submission, payer acknowledgement and final adjudication.",
    bullets: ["Pre-submission claim scrubbing", "24-hour filing standard", "Payer acknowledgement monitoring", "Claim-level status tracking"],
    metrics: [
      { value: "24 hrs", label: "Filing turnaround" },
      { value: "Claim-level", label: "Status visibility" },
      { value: "Clean-first", label: "Submission standard" },
    ],
    highlights: [
      {
        title: "Clean claims are cheaper than reworked claims",
        detail:
          "Each claim is checked for eligibility, authorization, coding consistency, modifiers and payer-specific rules before it leaves the building. Correcting an issue pre-submission takes minutes; correcting it after a denial takes weeks.",
      },
      {
        title: "Nothing sits in a workqueue",
        detail:
          "We monitor payer acknowledgements and rejection reports daily. Claims that were not accepted are corrected and refiled while the filing window is still open, and every open claim has documented follow-up activity.",
      },
      {
        title: "Visibility at the claim level",
        detail:
          "Your reporting shows submitted volume, acceptance, rejections, denials and outstanding claims by payer and provider — so you can see exactly where a claim is in the process.",
      },
    ],
    included: [
      "Charge entry and demographic validation",
      "Coding and modifier review",
      "Claim scrubbing against payer edits",
      "Electronic submission through your clearinghouse",
      "Paper claim support where required",
      "Payer acknowledgement and rejection review",
      "Corrected claim resubmission",
      "Secondary claim coordination",
      "Claim status follow-up",
      "Submission and acceptance reporting",
    ],
    faqs: [
      { q: "Do you use our clearinghouse?", a: "Yes. We work with your existing clearinghouse wherever possible, or help configure one if yours cannot support the automation needed." },
      { q: "How fast are claims filed?", a: "Our standard is filing within 24 hours of charge entry, so there is room to correct errors before filing deadlines are at risk." },
      { q: "Can you take over a claim backlog?", a: "Yes. We review open claims, prioritise by collectability and timely-filing risk, then work the backlog while keeping new claims current." },
    ],
  },
  {
    slug: "payment-posting",
    name: "Payment Posting",
    short: "Payment posting",
    tagline: "Accurate posting, reconciled daily — no silent underpayments.",
    icon: "ReceiptText",
    image: "/images/photos/team-office.jpg",
    intro:
      "Payment posting is where payer problems first become visible. We post ERAs and manual EOBs accurately, reconcile payments against contracted rates, and flag underpayments and patient responsibility so nothing is quietly written off.",
    bullets: ["ERA and manual EOB posting", "Contractual adjustment accuracy", "Underpayment identification", "Daily reconciliation"],
    metrics: [
      { value: "Daily", label: "Posting cadence" },
      { value: "Line-item", label: "Payment review" },
      { value: "Reconciled", label: "To contracted rates" },
    ],
    highlights: [
      {
        title: "Posting is a control, not data entry",
        detail:
          "Every posted payment is compared with the expected allowable for that payer and procedure. Differences become work: an appeal, a corrected claim or a contract conversation — instead of an unexplained adjustment.",
      },
      {
        title: "Patient responsibility posted correctly",
        detail:
          "Copay, deductible and coinsurance are posted to the correct buckets so patient statements are accurate and your team stops fielding avoidable billing questions.",
      },
      {
        title: "Clean credit balances and refunds",
        detail:
          "We review credits arising from secondary payments, retro-eligibility and duplicate payments, and prepare refunds for your approval so the ledger stays accurate.",
      },
    ],
    included: [
      "ERA auto-posting and matching",
      "Manual EOB entry when needed",
      "Contractual adjustment review",
      "Underpayment identification",
      "Patient responsibility allocation",
      "Secondary and tertiary payment posting",
      "Credit balance review",
      "Refund preparation for approval",
      "Denial routing from remittances",
      "Daily reconciliation reporting",
    ],
    faqs: [
      { q: "Can you post payments from scanned EOBs?", a: "Yes. Electronic remittances are matched automatically where available, and paper EOBs are posted manually with the same level of detail." },
      { q: "How do you catch underpayments?", a: "Payments are compared line by line with the contractual rate loaded for that payer and procedure. Variances are flagged for review rather than accepted." },
      { q: "Who approves refunds?", a: "We prepare and evidence them; your practice approves before anything is issued." },
    ],
  },
  {
    slug: "contracting-and-enrollment",
    name: "Contracting & Enrollment",
    short: "Contracting & enrollment",
    tagline: "Get in-network, stay enrolled, and keep agreements current.",
    icon: "Handshake",
    image: "/images/photos/presentation.jpg",
    intro:
      "A provider who cannot bill a payer is a provider who is not generating revenue. We manage payer applications, EDI enrollment, roster maintenance and contract administration so billing starts on time and agreements do not lapse.",
    bullets: ["Payer and network applications", "EDI and ERA enrollment", "Roster and location maintenance", "Contract term tracking"],
    metrics: [
      { value: "Organised", label: "Application tracking" },
      { value: "Current", label: "Payer rosters" },
      { value: "No gaps", label: "Contract renewals" },
    ],
    highlights: [
      {
        title: "Enrollment is a revenue gate",
        detail:
          "We prepare and submit payer applications, follow up until the file is approved, and confirm that the provider, group and location appear correctly in the payer directory before claims are filed.",
      },
      {
        title: "EDI, ERA and EFT setup",
        detail:
          "Electronic claims, remittance and payment enrollment are completed and tested so you are not posting paper remittances because a form was never submitted.",
      },
      {
        title: "Contracts that stay current",
        detail:
          "Renewal and revalidation dates are tracked in advance, and rate schedules are kept up to date in your billing system so underpayments are visible in reporting.",
      },
    ],
    included: [
      "Commercial and government payer applications",
      "Group and individual provider enrollment",
      "EDI and ERA/EFT enrollment",
      "Provider directory verification",
      "Roster and location change management",
      "Revalidation tracking",
      "Contract term and renewal tracking",
      "Fee schedule loading",
      "Payer follow-up and escalation",
      "Enrollment status reporting",
    ],
    faqs: [
      { q: "How long does enrollment take?", a: "Timelines vary by payer and can run from several weeks to a few months. Our follow-up cadence and tracking are what shorten the delay and prevent silent stalls." },
      { q: "Do you handle EDI and ERA enrollment?", a: "Yes — claims, remittance and electronic funds transfer enrollment are included so payments post electronically." },
      { q: "What happens when a provider adds a location?", a: "We verify that the location is on file with each payer and update the roster before services are billed there." },
    ],
  },
  {
    slug: "eft-era-edi-support",
    name: "EFT, ERA & EDI Support",
    short: "EFT, ERA & EDI support",
    tagline: "Electronic claims in, electronic payments out.",
    icon: "Network",
    image: "/images/photos/video-consult.jpg",
    intro:
      "Electronic data interchange is the plumbing of your revenue cycle. We configure and maintain claim submission, remittance advice and electronic funds transfer so payments arrive faster with fewer manual steps and clearer reconciliation.",
    bullets: ["EDI claim submission setup", "ERA enrollment and mapping", "EFT payment setup", "Clearinghouse issue resolution"],
    metrics: [
      { value: "Electronic", label: "Claim submission" },
      { value: "Auto-posted", label: "Remittances" },
      { value: "Faster", label: "Payment receipt" },
    ],
    highlights: [
      {
        title: "Fewer manual steps, faster cash",
        detail:
          "When claims leave electronically and remittances arrive automatically, the gap between service and payment narrows and your team stops keying data that should flow on its own.",
      },
      {
        title: "Enrollment handled end to end",
        detail:
          "We manage payer EDI and ERA enrollment, validate the connection and monitor acceptance so you know claims are reaching payers and remittances are returning.",
      },
      {
        title: "Problems diagnosed quickly",
        detail:
          "Rejected files, missing remittances and payer connectivity issues are investigated with the clearinghouse and payer, with the resolution documented for your records.",
      },
    ],
    included: [
      "Clearinghouse configuration review",
      "EDI claim submission setup",
      "ERA enrollment and mapping",
      "EFT enrollment coordination",
      "Remittance auto-posting setup",
      "Rejection and error file monitoring",
      "Payer connectivity troubleshooting",
      "Trading partner issue escalation",
      "Documentation of configurations",
      "Ongoing EDI support",
    ],
    faqs: [
      { q: "Do we need a specific clearinghouse?", a: "No. We work with your existing clearinghouse where it supports the required transactions, and advise if a change is genuinely necessary." },
      { q: "What is the benefit of ERA enrollment?", a: "Remittances post automatically and reconcile against your claims, which reduces manual entry and makes underpayments visible." },
      { q: "Can you troubleshoot existing EDI issues?", a: "Yes — missing remittances, rejected files and connectivity problems are investigated and escalated to the clearinghouse or payer as needed." },
    ],
  },
  {
    slug: "revenue-performance-reporting",
    name: "Revenue Performance & Reporting",
    short: "Revenue performance & reporting",
    tagline: "Know where the money is — and where it is stuck.",
    icon: "LineChart",
    image: "/images/photos/team-lounge.jpg",
    intro:
      "You cannot manage what you cannot see. We report the revenue cycle metrics that actually move cash — collections, clean claim acceptance, denials, days in A/R and charge lag — with the actions each number requires.",
    bullets: ["Monthly performance reporting", "Payer and provider drill-downs", "Days in A/R and denial trends", "Action plans, not data dumps"],
    metrics: [
      { value: "Monthly", label: "Executive reporting" },
      { value: "Payer-level", label: "Performance detail" },
      { value: "Actionable", label: "Follow-up plan" },
    ],
    highlights: [
      {
        title: "The five numbers that matter",
        detail:
          "Collections, claim acceptance, denial rate, days in A/R and charge lag. Everything else is supporting detail. We report these consistently so you can compare month to month and spot a problem early.",
      },
      {
        title: "Explained, not just displayed",
        detail:
          "Every report says what changed, why it changed and what we are doing about it. Where your team's help is needed — documentation, scheduling, front-desk data — we say so plainly.",
      },
      {
        title: "A review rhythm",
        detail:
          "Reporting is paired with a regular review, so trends are discussed while they are still actionable rather than discovered at year end.",
      },
    ],
    included: [
      "Monthly revenue cycle report",
      "Collections and payment trends",
      "Claim acceptance and rejection reporting",
      "Denial reason analysis",
      "Days in A/R and aging analysis",
      "Charge lag tracking",
      "Payer and provider performance breakdown",
      "Underpayment summary",
      "Written action plan",
      "Periodic performance review",
    ],
    faqs: [
      { q: "What reporting do we receive?", a: "A monthly summary covering collections, claim acceptance, denials, days in A/R, charge lag and outstanding balances, with commentary and a follow-up plan." },
      { q: "Can we see data between reports?", a: "Yes. Reporting is generated from your billing system, and on active engagements we can provide interim views on request." },
      { q: "Do you benchmark against other practices?", a: "We report against your own historical trend and against common industry benchmarks, clearly labelled as benchmarks rather than client results." },
    ],
  },
];

export type Audience = {
  slug: string;
  name: string;
  eyebrow: string;
  title: string;
  short: string;
  icon: string;
  image: string;
  intro: string;
  points: string[];
  services: string[];
  stat: { value: string; label: string };
};

export const audiences: Audience[] = [
  {
    slug: "healthcare-systems",
    name: "Healthcare Systems",
    eyebrow: "Multi-facility support",
    title: "Billing support built for healthcare systems",
    short: "Healthcare systems",
    icon: "Building2",
    image: "/images/photos/team-lounge.jpg",
    intro:
      "Hospitals have seen margins shrink with rising costs, a shortage of trained coders and ever-changing regulations. We act as an extension of your team and help you collect more, faster.",
    points: [
      "Tailored billing solutions for multi-facility systems",
      "A/R recovery and clean-up audits",
      "Inpatient DRG review and chart auditing",
      "Credentialing and prior authorization support",
      "Out-of-network negotiation",
      "Dedicated account manager",
    ],
    services: ["Complete RCM Services", "Accounts Receivable Management", "Credentialing & Contracting", "Out-of-Network Negotiation"],
    stat: { value: "20%+", label: "Higher reimbursements" },
  },
  {
    slug: "hospitals",
    name: "Hospitals",
    eyebrow: "Hospital billing services",
    title: "Hassle-free hospital billing, fewer costly errors",
    short: "Hospitals",
    icon: "Cross",
    image: "/images/photos/corridor-hospital.jpg",
    intro:
      "Our professional medical billing staff provides hassle-free hospital billing services and eliminates costly errors, resulting in speedier payments that match your organization's requirements.",
    points: [
      "Insurance eligibility and benefits verification",
      "Demographics and charge entry",
      "Hospital billing analysis and coding",
      "A/R follow-up and denial analysis",
      "Payment posting and ERA review",
      "Provider credentialing and OON negotiation",
    ],
    services: ["Medical Billing & Coding", "Accounts Receivable Management", "Complete RCM Services", "Chart Auditing & DRG Review"],
    stat: { value: "99.9%", label: "Claim acceptance rate" },
  },
  {
    slug: "emergency-rooms",
    name: "Emergency Rooms",
    eyebrow: "ER & free-standing ER billing",
    title: "High-volume ER billing without the revenue leaks",
    short: "Emergency rooms",
    icon: "Siren",
    image: "/images/photos/corridor-bright.jpg",
    intro:
      "Emergency billing moves fast and out-of-network exposure is high. We keep claims clean, file within 24 hours and negotiate aggressively with out-of-network pricing vendors on your behalf.",
    points: [
      "Emergency department and free-standing ER billing",
      "Eligibility and benefits verification",
      "Coding accuracy for high-acuity visits",
      "Denial management and appeals",
      "Out-of-network negotiation and settlement",
      "24/5 multilingual patient support",
    ],
    services: ["Medical Billing & Coding", "Out-of-Network Negotiation", "Accounts Receivable Management", "Eligibility & Benefits Verification"],
    stat: { value: "24 hrs", label: "Claim filing" },
  },
  {
    slug: "urgent-cares",
    name: "Urgent Cares",
    eyebrow: "Urgent care billing",
    title: "Urgent care billing that keeps up with your volume",
    short: "Urgent cares",
    icon: "Activity",
    image: "/images/photos/doctors-discussing.jpg",
    intro:
      "Urgent care runs on volume and speed. Our team works in your software, files claims within 24 hours and follows up on every unpaid balance so front-desk momentum becomes revenue.",
    points: [
      "Charge entry and demographics accuracy",
      "Insurance eligibility verification",
      "Copay and deductible collection support",
      "Coding for E/M and procedure visits",
      "Denial follow-up and appeals",
      "Real-time reporting",
    ],
    services: ["Medical Billing & Coding", "Eligibility & Benefits Verification", "Complete Patient Billing", "Complete RCM Services"],
    stat: { value: "24/5", label: "Support coverage" },
  },
  {
    slug: "private-practices",
    name: "Private Practices",
    eyebrow: "Independent practice support",
    title: "An extension of your staff for private practices",
    short: "Private practices",
    icon: "Stethoscope",
    image: "/images/photos/doctor-doorway.jpg",
    intro:
      "Private practices often see revenue decline from limited RCM knowledge and documentation errors. We supplement your business practices, train your team and keep claims clean and filed on time.",
    points: [
      "Documentation training and feedback",
      "Code and compliance updates",
      "Claims filed within 24 hours",
      "Denial correction and resubmission",
      "Patient statements and patient calls",
      "Eligibility and benefits verification",
    ],
    services: ["Medical Billing & Coding", "Accounts Receivable Management", "Credentialing & Contracting", "Complete Patient Billing"],
    stat: { value: "99.9%", label: "Claim acceptance" },
  },
];

export type Specialty = {
  slug: string;
  name: string;
  group: string;
  icon: string;
  blurb: string;
  focus: string[];
};

const specialtySeed: [string, string, string, string, string, string[]][] = [
  ["cardiology", "Cardiology", "Specialty medicine", "HeartPulse", "Diagnostics, intervention and device billing with careful attention to bundling and medical necessity.", ["Diagnostic vs. therapeutic coding", "Echo and stress testing", "Device and procedure billing"]],
  ["anesthesia", "Anesthesia", "Surgical", "Syringe", "Time-based anesthesia units, modifiers and medical direction documentation coded accurately.", ["Anesthesia time units", "Medical direction modifiers", "Concurrent cases"]],
  ["pediatrics", "Pediatrics", "Primary care", "Baby", "Well-child visits, immunizations and preventive services billed correctly alongside sick visits.", ["Well vs. sick visits", "Immunization administration", "Developmental screening"]],
  ["internal-medicine", "Internal Medicine", "Primary care", "Stethoscope", "Chronic care management, preventive visits and E/M leveling supported by documentation review.", ["E/M level accuracy", "Chronic care management", "Preventive services"]],
  ["radiology", "Radiology", "Diagnostics", "ScanLine", "High-volume imaging claims with contrast, interpretation and technical component accuracy.", ["Contrast coding", "Global vs. technical", "High-volume scrubbing"]],
  ["neurology", "Neurology", "Specialty medicine", "Brain", "Neurology evaluation, testing and infusion services with payer-specific documentation support.", ["EMG and EEG coding", "Infusion administration", "Medical necessity"]],
  ["chiropractic", "Chiropractic", "Specialty medicine", "Activity", "Treatment plans, visit limits and maintenance care distinctions documented and billed properly.", ["Treatment plan documentation", "Visit limit tracking", "Maintenance care"]],
  ["orthopedic", "Orthopedic", "Surgical", "Bone", "Fracture care, arthroscopy and joint replacement coding with global period and implant expertise.", ["Global surgical periods", "Fracture care coding", "Implant billing"]],
  ["physical-therapy", "Physical Therapy", "Specialty medicine", "Activity", "Timed codes, plan of care updates and visit caps tracked so every billable unit is captured.", ["Timed code units", "Plan of care updates", "Visit cap tracking"]],
  ["pathology", "Pathology", "Diagnostics", "Microscope", "Professional component billing, special stains and molecular testing mapped to payer policy.", ["Technical vs. professional", "Special stain coding", "Molecular test policies"]],
  ["dermatology", "Dermatology", "Specialty medicine", "Sparkles", "Medical versus cosmetic distinction, pathology and destruction coding that protects revenue.", ["Medical necessity", "Pathology billing", "Cosmetic carve-out"]],
  ["oncology", "Oncology", "Specialty medicine", "Ribbon", "Infusion administration, drug J-codes and NDC units handled with precision and authorization tracking.", ["Drug and J-code billing", "NDC unit conversion", "Prior authorization"]],
  ["gastroenterology", "Gastroenterology", "Specialty medicine", "Search", "Screening versus diagnostic colonoscopy, polyp removal and anesthesia coordination.", ["Screening vs. diagnostic", "Polyp removal coding", "Anesthesia coordination"]],
  ["nephrology", "Nephrology", "Specialty medicine", "Droplets", "CKD staging, dialysis coordination and care management coding for renal practices.", ["CKD stage coding", "Dialysis coordination", "Care management codes"]],
  ["mental-health", "Mental Health", "Specialty medicine", "HeartHandshake", "Time-based therapy codes, group sessions and authorizations managed with sensitivity.", ["Time-based documentation", "Group therapy billing", "Authorization units"]],
  ["podiatry", "Podiatry", "Surgical", "Footprints", "Foot and ankle procedures, routine care distinctions and DME billing handled accurately.", ["Routine vs. surgical care", "DME billing", "Procedure modifiers"]],
  ["urology", "Urology", "Surgical", "Droplets", "Cystoscopy, urodynamics and in-office procedure coding with bundled service awareness.", ["Cystoscopy coding", "Urodynamics billing", "Bundled services"]],
  ["family-practice", "Family Practice", "Primary care", "Stethoscope", "Preventive, acute and chronic visit coding with documentation coaching for the whole team.", ["E/M level accuracy", "Preventive vs. problem", "Documentation coaching"]],
  ["ob-gyn", "Ob/Gyn", "Specialty medicine", "Flower2", "Global OB packages, deliveries, ultrasound and gynecologic procedures without missed components.", ["Global OB packages", "Delivery billing", "Ultrasound coding"]],
  ["occupational-therapy", "Occupational Therapy", "Specialty medicine", "HeartHandshake", "OT evaluation and treatment coding with goal-based documentation and visit tracking.", ["Evaluation coding", "Timed treatment units", "Goal documentation"]],
  ["ophthalmology", "Ophthalmology", "Surgical", "Eye", "Cataract packages, retina injections and diagnostic testing managed with global care awareness.", ["Cataract global care", "Retina injection codes", "Diagnostic testing"]],
  ["pain-management", "Pain Management", "Specialty medicine", "Syringe", "Interventional procedures, fluoroscopic guidance and frequent authorization requirements.", ["Fluoroscopic guidance", "Authorization cadence", "Modifier accuracy"]],
  ["home-health", "Home Health", "Facility & community", "Home", "OASIS documentation, episode billing and authorization tracking for home health agencies.", ["OASIS documentation", "Episode billing", "Authorization tracking"]],
  ["hospitalists", "Hospitalists", "Facility & community", "BedDouble", "Admission, subsequent and discharge coding with DRG awareness and documentation review.", ["Admission and discharge", "DRG awareness", "Documentation review"]],
  ["emergency-rooms", "Emergency Rooms", "Facility & community", "Siren", "High-acuity ED coding, out-of-network exposure and rapid claim filing for emergency providers.", ["High-acuity coding", "Out-of-network claims", "Rapid filing"]],
  ["urgent-care", "Urgent Care", "Facility & community", "Cross", "High-volume visits, point-of-service collection and clean claims in a fast-moving setting.", ["E/M level accuracy", "Copay collection", "Volume scrubbing"]],
  ["healthcare-billing", "Healthcare Billing", "Facility & community", "BarChart3", "Third-party billing operations, reporting and workflow support for billing entities.", ["Operational reporting", "Workflow design", "Payer follow-up"]],
  ["dental-sleep", "Dental & Sleep Medicine", "Specialty medicine", "Moon", "Sleep studies, appliances and medical-dental cross-coding with payer policy checks.", ["Sleep study billing", "Appliance coding", "Medical necessity"]],
  ["wound-care", "Wound Care", "Specialty medicine", "Bandage", "Debridement, grafts and hyperbaric services with documentation and bundling review.", ["Debridement coding", "Hyperbaric billing", "Bundling review"]],
  ["behavioral-health", "Behavioral Health", "Specialty medicine", "HandHeart", "Psychiatric evaluation, medication management and therapy coding with parity awareness.", ["Evaluation and therapy codes", "Parity appeals", "Authorization tracking"]],
];

export const specialties: Specialty[] = specialtySeed.map(([slug, name, group, icon, blurb, focus]) => ({
  slug,
  name,
  group,
  icon,
  blurb,
  focus,
}));

export const specialtyGroups = ["All", "Primary care", "Specialty medicine", "Surgical", "Diagnostics", "Facility & community"];

export const benefits = [
  { title: "More focus on patient care", detail: "Your clinicians stay with patients while billing runs in the background.", icon: "HeartHandshake" },
  { title: "Reduced administrative duties", detail: "Charge entry, follow-up, statements and payer calls move off your desk.", icon: "ClipboardCheck" },
  { title: "Enhanced cash flow", detail: "Clean claims filed within 24 hours and follow-up on every open balance.", icon: "TrendingUp" },
  { title: "Reduced billing errors", detail: "Certified coders and error checks before submission protect reimbursements.", icon: "ShieldCheck" },
  { title: "Improved patient satisfaction", detail: "Accurate eligibility means fewer overcharges, refunds and frustrated patients.", icon: "Smile" },
  { title: "Secured patient data", detail: "HIPAA-compliant processes, secure data flow and confidentiality built in.", icon: "Lock" },
  { title: "Billing compliance", detail: "Coding follows payer rules and current regulations, with audits to prove it.", icon: "Gavel" },
  { title: "Faster claim processing", detail: "Claims filed within 24 hours with a 99.9% acceptance rate.", icon: "Zap" },
];

export const coreValues = [
  { title: "Transparency", detail: "Open and honest communication, keeping you informed at every step of the billing process.", icon: "Eye" },
  { title: "Accuracy", detail: "Meticulous attention to detail so services are accurately coded and billed to maximize revenue.", icon: "Target" },
  { title: "Timely filing", detail: "Prompt claim submission that minimizes delays and optimizes reimbursement turnaround.", icon: "Clock3" },
  { title: "Personalized account management", detail: "A dedicated, knowledgeable team member for every client, tailoring service to your needs.", icon: "UserRound" },
  { title: "Accessibility", detail: "Readily available to answer questions and provide support whenever you need us.", icon: "Headphones" },
];

export const processSteps = [
  {
    step: "01",
    title: "Free consultation",
    duration: "Day 1",
    detail:
      "We interview you about what you are looking for in a medical billing company, review your current setup, payers and software, and confirm where revenue is leaking.",
    points: ["Discovery call and practice review", "Software and workflow check", "No prepayment required", "Scope and team assigned"],
  },
  {
    step: "02",
    title: "Team built around you",
    duration: "Days 2–3",
    detail:
      "We build a billing and coding team dedicated to your facility, aligned to your specialty, your payers and the software you already use — no new system to learn.",
    points: ["Dedicated billers and coders", "Software access and setup", "Payer and credentialing review", "Documentation standards agreed"],
  },
  {
    step: "03",
    title: "Clean-up and stabilization",
    duration: "Days 4–5",
    detail:
      "We audit and stabilize the revenue cycle, work the outstanding A/R, correct the root causes we find and rebuild the claim workflow.",
    points: ["Revenue cycle audit", "A/R follow-up and recovery", "Denial correction and appeals", "Process fixes documented"],
  },
  {
    step: "04",
    title: "Ongoing RCM and reporting",
    duration: "Ongoing",
    detail:
      "Claims filed within 24 hours, denials worked, patients supported and reports delivered in real time — with your dedicated account manager available 24/5.",
    points: ["Claims filed within 24 hours", "Denial management and appeals", "Patient statements and calls", "Real-time reporting and reviews"],
  },
];

export const rcmLifecycle = [
  "Appropriate RCM software",
  "Insurance eligibility and verification",
  "Patient pre-certification or pre-authorization",
  "Demographics and charge entry",
  "Copayments and deductibles",
  "Filing claims",
  "Remuneration for services rendered",
  "Denial management",
  "Billing and collection services",
  "Medical appeals",
  "Refund handling",
];

export const billingSoftware = [
  "CollaborateMD", "Medisoft", "Medical Manager", "DocuTap / Experity", "eClinicalWorks", "NextGen", "AdvancedMD", "Kareo", "GoRev", "Elligence", "Epic", "Cerner",
];

export const payerLogos = ["Blue Cross Blue Shield", "UnitedHealth Group", "Humana", "Anthem", "Aetna", "Cigna", "Medicare", "Medicaid"];

export type Article = {
  slug: string;
  title: string;
  category: string;
  excerpt: string;
  image: string;
  readTime: string;
  date: string;
  author: string;
  body: { heading?: string; paragraphs: string[]; list?: string[] }[];
};

export const articles: Article[] = [
  {
    slug: "clean-claim-playbook",
    title: "The clean claim playbook: checks that stop denials before submission",
    category: "Billing & coding",
    excerpt:
      "Most denials are decided before the claim leaves your building. These are the checks our coders run on every claim before it is filed.",
    image: "/images/photos/documents-team.jpg",
    readTime: "6 min read",
    date: "2026-02-10",
    author: "Knight Medical Billing Team",
    body: [
      { paragraphs: ["A denial is rarely a payer surprise. It is usually the result of a preventable data gap — a missing modifier, an expired authorization, a mismatched diagnosis. Building a clean claim means checking those gaps before submission, not after."] },
      { heading: "Verify eligibility before the visit", paragraphs: ["Confirm coverage, member ID, group ID, coverage dates, copay, deductible and coinsurance before the patient is seen. Eligibility and benefits verification is the first and most critical step in the billing process."] },
      { heading: "Confirm authorization and referral requirements", paragraphs: ["Match the authorization to the scheduled service and to the CPT codes billed. Flag any variance before charge entry rather than discovering it in a denial."] },
      { heading: "Check diagnosis support and modifiers", paragraphs: ["Load payer-specific medical-necessity policies for your highest-volume codes, and review bundling and modifier use against the actual documentation."] },
      { heading: "Watch the clock", paragraphs: ["Timely filing is unforgiving. Every claim should be filed within 24 hours of charge entry so there is room to correct and resubmit without risking the filing limit."] },
      { heading: "Measure what you catch", paragraphs: ["Track how many errors each check catches each week. If a check stops catching anything, something upstream changed — your checks are the early warning system for the whole revenue cycle."] },
    ],
  },
  {
    slug: "eligibility-verification-first-step",
    title: "Why eligibility verification is the first step in the revenue cycle",
    category: "Eligibility",
    excerpt:
      "Failure to validate eligibility and authorization leads to delayed payments and denials. Here is what a thorough verification should confirm.",
    image: "/images/photos/reception.jpg",
    readTime: "5 min read",
    date: "2026-01-22",
    author: "Knight Medical Billing Team",
    body: [
      { paragraphs: ["Delaying reimbursements has a direct influence on cash flow. Eligibility verification protects the front of the revenue cycle so the back end has something to collect."] },
      { heading: "What to confirm for every patient", paragraphs: ["A complete verification confirms primary and secondary coverage, member and group IDs, coverage duration, copay, deductible, coinsurance and benefit details — plus whether the plan requires pre-authorization or a referral."], list: ["Primary and secondary coverage", "Member ID and group ID", "Coverage start and end dates", "Copay, deductible and coinsurance", "Authorization or referral requirements"] },
      { heading: "Fix missing data immediately", paragraphs: ["Identify and resolve missing or incorrect data as early as possible. A phone call before the visit is far cheaper than an eligibility denial after it."] },
      { heading: "Look for hidden coverage", paragraphs: ["Electronically linking self-paid patients with managed Medicaid databases can uncover coverage patients did not know they had — raising self-pay revenue and releasing patients from costs they should not carry."] },
    ],
  },
  {
    slug: "ar-follow-up-that-recovers-cash",
    title: "A/R follow-up that actually recovers cash",
    category: "A/R management",
    excerpt:
      "Outstanding receivables over 180 days rarely resolve on their own. A follow-up structure that works, from aging buckets to appeals.",
    image: "/images/photos/support-desk.jpg",
    readTime: "6 min read",
    date: "2026-01-08",
    author: "Knight Medical Billing Team",
    body: [
      { paragraphs: ["Providers often find their accounts receivable growing while cash flow stays flat. Without active, regular follow-up on current billings, balances over 180 days become common."] },
      { heading: "Start with aging buckets", paragraphs: ["Sort receivables by age, payer and dollar value. Prioritize the buckets where recovery is still possible under timely filing rules."] },
      { heading: "Investigate before you appeal", paragraphs: ["Find out why the claim was denied or underpaid. Correct eligibility, coding, authorization or documentation issues before resubmitting — otherwise the same denial returns."] },
      { heading: "Post payments accurately", paragraphs: ["Review ERAs and scanned EOBs so every payment detail reaches the patient account. Payment posting is the first line of defense in recognizing payer issues such as medical-necessity or non-covered denials."] },
      { heading: "Close the loop", paragraphs: ["Each recovered denial should produce a process change: an edit, a checklist item or a training note. That is how receivables stop rebuilding themselves."] },
    ],
  },
  {
    slug: "out-of-network-negotiation-explained",
    title: "Out-of-network negotiation explained: pre-payment and post-payment",
    category: "Out-of-network",
    excerpt:
      "Out-of-network billing is the trickiest part of the industry. Understanding how pricing vendors work is the first step to recovering more.",
    image: "/images/photos/documents-desk.jpg",
    readTime: "6 min read",
    date: "2025-12-15",
    author: "Knight Medical Billing Team",
    body: [
      { paragraphs: ["Negotiating out-of-network claims matters most for hospitals and free-standing emergency rooms, where out-of-network exposure is highest. Insurers often route these claims through pricing vendors that propose settlements below what the service is worth."] },
      { heading: "Know the vendors", paragraphs: ["Pricing vendors such as Multiplan, Zelis, Viant and GCS evaluate claims on behalf of payers. Knowing their terminology and their methodology is what makes negotiation possible."] },
      { heading: "Pre-payment negotiation", paragraphs: ["This is negotiating an offer received before the claim is reimbursed. Time matters here — the earlier an offer is disputed, the more leverage remains."] },
      { heading: "Post-payment re-negotiation", paragraphs: ["When the claim has already been reimbursed based on vendor pricing, it can still be re-opened and negotiated. Building a database of historical outcomes makes underpayments easier to spot."] },
      { heading: "Protect the patient too", paragraphs: ["Analyze historical data for your locality and negotiate from that analysis. Patients should not be left with outsized out-of-pocket costs caused by an underpaid claim."] },
    ],
  },
  {
    slug: "credentialing-contracts-and-rates",
    title: "Credentialing and contracting: the foundation of reimbursement",
    category: "Credentialing",
    excerpt:
      "Getting into the right networks — with contracts that pay properly — is where a new practice's revenue either works or stalls.",
    image: "/images/photos/stethoscope-notes.jpg",
    readTime: "5 min read",
    date: "2025-11-27",
    author: "Knight Medical Billing Team",
    body: [
      { paragraphs: ["Credentialing and contracting are the basis of starting a clinic or healthcare facility. They lay the foundation for relationships with insurance companies and patients alike."] },
      { heading: "Why network access matters", paragraphs: ["Patients look for in-network providers, so network access expands your potential patient pool. The contract behind that access determines whether the additional volume is actually profitable."] },
      { heading: "Negotiate with data", paragraphs: ["Effective negotiation uses locality, patient volume and service mix. Without that context, low rates quietly erode the margin on every visit."] },
      { heading: "Keep contracts current", paragraphs: ["Track contract terms and expirations, keep provider data and CAQH profiles current, and complete revalidations on time. A lapsed credential can pause billing entirely."] },
    ],
  },
  {
    slug: "revenue-cycle-clean-up-audit",
    title: "The revenue cycle audit: finding the source of the leak",
    category: "Revenue cycle",
    excerpt:
      "Working harder on the backlog does not fix a broken process. A clean-up audit finds why the backlog exists in the first place.",
    image: "/images/photos/desk-charts.jpg",
    readTime: "5 min read",
    date: "2025-11-05",
    author: "Knight Medical Billing Team",
    body: [
      { paragraphs: ["When revenue drops, most practices respond by working more claims. That treats the symptom. A clean-up audit treats the cause."] },
      { heading: "Where leaks usually start", paragraphs: ["Documentation gaps, incorrect codes, missed eligibility, expired authorizations, unposted payments and stalled follow-up. Most issues surface during the audit, and documentation-related errors are frequently recoverable early."], list: ["Documentation and coding accuracy", "Eligibility and authorization gaps", "Payment posting and reconciliation", "Denial follow-up and appeals", "Timely filing exposure"] },
      { heading: "Build the prevention plan", paragraphs: ["A useful audit ends with a written plan: what changed, who owns it and how you will know it worked. Otherwise the same leak returns within a year."] },
      { heading: "Then keep watching", paragraphs: ["Ongoing reports on clean claim rate, denial reasons, days in A/R and collections tell you whether the fix held. Transparency at every step is how a billing partner earns trust."] },
    ],
  },
];

export const faqs = [
  { q: "What makes Knight Medical Billing different from other billing companies?", a: "Two qualities our clients cite most: accessibility and knowledge. Every client gets a dedicated, highly knowledgeable team member who answers questions promptly — you are never just another number. Our claim acceptance rate is 99.9% and claims are filed within 24 hours." },
  { q: "Do you require prepayment or setup fees?", a: "No. Our process starts with no prepayment and no hidden fees. We begin with a consultation, confirm scope, and build a dedicated team around your facility." },
  { q: "How fast can we get started?", a: "Our onboarding is a fast, easy 5-day process: consultation, team assignment, clean-up and stabilization, then ongoing RCM. Support is available 24/5 in multiple languages." },
  { q: "Which facilities do you serve?", a: "Hospitals, healthcare systems, emergency rooms, free-standing emergency rooms, urgent cares, private practices and clinics across the United States." },
  { q: "Which specialties do you bill for?", a: "Cardiology, anesthesia, pediatrics, internal medicine, radiology, neurology, chiropractic, orthopedic, physical therapy, pathology, dermatology, oncology, gastroenterology, nephrology, mental health, podiatry, urology, family practice, Ob/Gyn, occupational therapy, ophthalmology, pain management, home health, hospitalists, emergency rooms, urgent care and more." },
  { q: "What billing software do you work in?", a: "We work in CollaborateMD, Medisoft, Medical Manager, DocuTap/Experity, eClinicalWorks, NextGen, AdvancedMD, Kareo, GoRev, Elligence and other major platforms — we adapt to your system rather than asking you to change." },
  { q: "Do you handle out-of-network claims?", a: "Yes. Out-of-network negotiation is one of our specialties. We negotiate with pricing vendors such as Multiplan, Zelis, Viant and GCS on pre-payment and post-payment claims, using our own OON database to identify underpaid claims." },
  { q: "Is my patient data secure?", a: "Yes. We follow HIPAA requirements with complete data and document security, strict quality control and information security policies, and secure data flow between Knight Medical Billing and our partners." },
  { q: "What happens if a claim is denied?", a: "Our accounts receivable team determines the reason, corrects the cause and resubmits within the timely filing limit. If information was missing, we close the gap immediately and track the denial trend to prevent repetition." },
  { q: "Can you train our existing staff?", a: "Yes. We train staff on scheduling and registration, insurance eligibility checks, copayment and deductible collection and better charting practices, and we can educate your team on compliance and workflow." },
  { q: "How will I know what is happening with my revenue cycle?", a: "You receive real-time reporting on your revenue cycle along with a dedicated account manager. We keep you informed on performance and the changes that can improve it." },
  { q: "How do I contact Knight Medical Billing?", a: "Call (812) 994-0046 or email admin@knightmedicalbilling.com. Our office is at 585 Grove St Ste 145, Herndon, VA 20170-4790, and we are open Monday to Friday, 8:00 AM to 5:00 PM ET." },
];

export const leadership = [
  {
    name: "Lawrence Fianko",
    role: "CEO & Founder",
    image: "/images/ceo-lawrence-fianko.jpg",
    bio: "Lawrence is a visionary leader driven by a commitment to improving healthcare. With a background as a mental health and addiction therapist, he brings over five years of clinical experience and a deep understanding of the challenges providers face.",
    detail:
      "As founder of Limelight Recovery he experienced the financial and administrative burdens that hinder quality care, which led him to revolutionize revenue cycle management. He also serves as CEO of Educational Communities Worldwide, a non-profit providing educational resources to underprivileged students in Africa.",
  },
];

export const stats = [
  { value: "99.9%", label: "Claim acceptance rate" },
  { value: "24 hrs", label: "Claim filing window" },
  { value: "25 yrs", label: "Combined experience" },
  { value: "24/5", label: "Support availability" },
];

export const collectionBands = ["Under $25k", "$25k – $50k", "$50k – $100k", "$100k – $250k", "$250k – $500k", "$500k+"];
