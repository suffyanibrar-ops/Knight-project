import { redirect } from "next/navigation";

/** The editor moved to its own module; keep old links working. */
export default function LegacyNewBlogPostPage() {
  redirect("/admin/blog/editor/new");
}
