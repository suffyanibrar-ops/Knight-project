import { redirect } from "next/navigation";

/**
 * The separate CRM "Submissions" view was removed: the raw form inbox at
 * /admin/inbox is the complete record of every enquiry, so the owner had two
 * near-identical modules. Kept as a redirect so old bookmarks do not 404.
 */
export default function RemovedSubmissionsPage() {
  redirect("/admin/inbox");
}
