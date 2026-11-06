import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/auth";
import { LiveTraffic } from "@/components/admin/live-traffic";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Live Traffic · Admin", robots: { index: false, follow: false } };

export default async function AdminTrafficPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
  return <LiveTraffic />;
}
