# Knight Medical Billing — Image Inventory

All new assets below are Pexels-licensed photography, not generated or AI-composited. Next.js emits optimized AVIF/WebP variants from the source JPEGs. Provenance is recorded in `src/lib/photos.ts`.

| Asset | Page / section | Purpose | Source dimensions | Format | Alt text |
|---|---|---|---|---|---|
| `medical-billing-software-hub.jpg` | `/software` hero | Software and EHR expertise hub | 1600×1067 | JPEG → AVIF/WebP | Billing specialist reviewing revenue-cycle software |
| `advancedmd-billing-workflow.jpg` | `/software/advancedmd-medical-billing` | AdvancedMD workflow hero | 1600×2400 | JPEG → AVIF/WebP | Administrator working with practice paperwork and a tablet |
| `eclinicalworks-revenue-cycle.jpg` | `/software/eclinicalworks-medical-billing` | eClinicalWorks practice workflow hero | 1600×1068 | JPEG → AVIF/WebP | Practice team coordinating at a clinic front desk |
| `nextgen-medical-billing.jpg` | `/software/nextgen-medical-billing` | NextGen practice-management hero | 1600×1067 | JPEG → AVIF/WebP | Clinician reviewing notes beside a laptop |
| `tebra-practice-billing.jpg` | `/software/tebra-kareo-medical-billing` | Tebra independent-practice hero | 1600×1068 | JPEG → AVIF/WebP | Medical administrator organizing a practice billing calendar |
| `collaboratemd-billing-workflow.jpg` | `/software/collaboratemd-medical-billing` | CollaborateMD claims workflow hero | 1600×1067 | JPEG → AVIF/WebP | Professional working through billing details on a laptop |
| `experity-billing-services.jpg` | `/software/experity-docutap-medical-billing` | Experity urgent-care billing hero | 1600×2400 | JPEG → AVIF/WebP | Clinician working at a desk in a modern care environment |
| `mental-health-billing-workflow.jpg` | `/specialties/mental-health-billing` | Behavioral-health billing hero | 1600×1067 | JPEG → AVIF/WebP | Counselor speaking with a family in a calm behavioral-health setting |
| `physical-therapy-billing-clinic.jpg` | `/specialties/physical-therapy-billing` | Physical-therapy billing hero | 1600×1067 | JPEG → AVIF/WebP | Physical therapist treating a patient in a rehabilitation clinic |
| `podiatry-xray.jpg` | `/specialties/podiatry-billing` | Podiatry billing hero | 1600×1067 | JPEG → AVIF/WebP | Clinician reviewing a foot X-ray on a tablet |
| `revenue-performance-reporting-team.jpg` | `/results` hero | Revenue performance and results | 1600×900 | JPEG → AVIF/WebP | Revenue team reviewing performance charts |
| `medical-billing-pricing-calculator.jpg` | `/tools/revenue-leak-calculator` | Pricing/indicator tool hero | 1600×1067 | JPEG → AVIF/WebP | Financial planning with a calculator and reports |
| `why-knight-team-collaboration.jpg` | `/why-knight` hero | Why Knight / clinical collaboration | 1600×1067 | JPEG → AVIF/WebP | Clinicians collaborating in a modern care setting |
| `case-studies-healthcare-team.jpg` | `/results/case-studies` hero and buyer-guide thumbnail | Results and selecting a partner | 1600×1068 | JPEG → AVIF/WebP | Healthcare team reviewing information at a front desk |
| `credentialing-provider-enrollment.jpg` | `/services/credentialing-and-contracting` hero | Provider enrollment and credentialing workflow | 1600×1067 | JPEG → AVIF/WebP | Provider reviewing enrollment paperwork |
| `contact-practice-reception.jpg` | `/contact` hero | Practice contact and front-desk context | 1600×1067 | JPEG → AVIF/WebP | Practice receptionist assisting a patient |
| `schedule-consultation-call.jpg` | `/schedule-form` hero | Consultation scheduling context | 1600×2400 | JPEG → AVIF/WebP | Clinician working at a laptop in a consultation room |
| `process-revenue-cycle-planning.jpg` | `/our-process` hero | Revenue-cycle planning and process | 1600×1067 | JPEG → AVIF/WebP | Team discussing an operational plan in a meeting |
| `insights-medical-billing-reading.jpg` | `/insights` hero | Educational resources and research | 1600×1067 | JPEG → AVIF/WebP | Professional reading a printed report beside a laptop |

## Existing image-system rules

- `src/lib/photos.ts` is the only source of approved photography paths and credits.
- `src/components/sections/visuals.ts` assigns photos by page/section.
- Hero images are not reused across unrelated primary SEO page heroes.
- Service pages retain their service-specific images.
- Decorative images use empty alt text; meaningful page imagery receives descriptive alt text.
- Next.js `Image` supplies responsive `srcset`/`sizes`; above-the-fold hero images use priority loading.
- No competitor imagery, watermarked assets or unlicensed assets are used.
