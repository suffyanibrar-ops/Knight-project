import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SpecialtyBillingPage } from "@/components/seo/specialty-billing-page";
import { pageMetadata } from "@/lib/seo";
import { specialtyBillingGuides } from "@/lib/seo-content";

const guide = specialtyBillingGuides.find((item) => item.slug === "mental-health-billing");

export const metadata: Metadata = guide
  ? pageMetadata({ title: guide.title, description: guide.description, path: `/specialties/mental-health-billing`, keywords: ["mental health billing", "behavioral health billing"] })
  : { title: "Specialty page not found" };

export default function Page() {
  if (!guide) notFound();
  return <SpecialtyBillingPage guide={guide} />;
}
