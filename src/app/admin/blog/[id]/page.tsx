import { redirect } from "next/navigation";

/** The editor moved to its own module; keep old links working. */
export default async function LegacyEditBlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/admin/blog/editor/${id}`);
}
