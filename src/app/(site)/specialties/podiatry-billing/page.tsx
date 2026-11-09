import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SpecialtyBillingPage } from "@/components/seo/specialty-billing-page";
import { pageMetadata } from "@/lib/seo";
import { specialtyBillingGuides } from "@/lib/seo-content";

const guide = specialtyBillingGuides.find((item) => item.slug === "podiatry-billing");

export const metadata: Metadata = guide
  ? pageMetadata({ title: guide.title, description: guide.description, path: `/specialties/podiatry-billing`, keywords: ["podiatry billing", "podiatry medical billing"] })
  : { title: "Specialty page not found" };

export default function Page() {
  if (!guide) notFound();
  return <SpecialtyBillingPage guide={guide} />;
}
