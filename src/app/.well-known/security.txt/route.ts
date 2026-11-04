export const dynamic = "force-static";

export function GET() {
  const body = [
    "# Security contact for Knight Medical Billing",
    "Contact: mailto:admin@knightmedicalbilling.com",
    "Contact: tel:+1-812-994-0046",
    "Expires: 2027-12-31T23:59:00.000Z",
    "Preferred-Languages: en",
    `Canonical: ${process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://www.knightmedicalbilling.com"}/.well-known/security.txt`,
    `Policy: ${process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://www.knightmedicalbilling.com"}/hipaa-compliance`,
    "",
    "# Report suspected vulnerabilities or privacy incidents here.",
    "# Please include reproduction steps and do not access or modify patient data.",
    "",
  ].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400" } });
}
