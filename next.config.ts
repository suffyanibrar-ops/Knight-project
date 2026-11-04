import type { NextConfig } from "next";

/**
 * Host-agnostic Next.js configuration.
 *
 * This project is a full-stack Next.js application (App Router + route handlers
 * + middleware + Drizzle/Postgres). It is deliberately NOT exported statically:
 * there is no `output: 'export'`, because the admin console, the form APIs and
 * the database layer all require a server runtime.
 */

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https:",
      "frame-ancestors 'self'",
      "form-action 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // The embedded SQLite driver is a native module and must stay external to the
  // server bundle (it is loaded at runtime, not bundled by webpack/turbopack).
  serverExternalPackages: ["better-sqlite3"],

  poweredByHeader: false,
  compress: true,
  reactStrictMode: true,

  // Allow the Google AI Studio / Cloud Run dev host to talk to the dev server
  // (prevents "Blocked cross-origin request" when previewing the app).
  allowedDevOrigins: ["ais-dev-vdquyz2ozg4bjeiy4hgdx6-797145459235.asia-southeast1.run.app"],

  // next/image is used throughout. Local files live in /public/images and
  // external assets are served from Cloudinary, which must be allow-listed.
  images: {
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
    // Escape hatch for hosts that cannot run the sharp optimiser: set
    // IMAGES_UNOPTIMIZED=1 to serve the original files unchanged.
    unoptimized: process.env.IMAGES_UNOPTIMIZED === "1",
    formats: ["image/avif", "image/webp"],
    deviceSizes: [360, 420, 640, 768, 1024, 1280, 1536, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },

  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      {
        source: "/admin/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Cache-Control", value: "no-store, max-age=0" },
        ],
      },
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }] },
    ];
  },

  // Permanent redirects from the previous WordPress URLs.
  async redirects() {
    return [
      { source: "/request-demo", destination: "/schedule-form", permanent: true },
      // Top-level labels that visitors may type directly.
      { source: "/resources", destination: "/insights", permanent: true },
      { source: "/company", destination: "/about", permanent: true },
      { source: "/speciality", destination: "/specialties", permanent: true },
      { source: "/service", destination: "/services", permanent: true },
      { source: "/contactus", destination: "/contact", permanent: true },
      { source: "/contact-us", destination: "/contact", permanent: true },
      { source: "/about-us", destination: "/about", permanent: true },
      { source: "/our-services", destination: "/services", permanent: true },
      { source: "/case-studies", destination: "/results", permanent: true },
      { source: "/case-studies/:slug", destination: "/results", permanent: true },
      { source: "/platform", destination: "/our-process", permanent: true },
      { source: "/pricing", destination: "/services", permanent: true },
      { source: "/services/medical-billing-services", destination: "/services/medical-billing-and-coding", permanent: true },
      { source: "/services/medical-coding", destination: "/services/medical-billing-and-coding", permanent: true },
      { source: "/services/credentialing", destination: "/services/credentialing-and-contracting", permanent: true },
      { source: "/services/ar-recovery", destination: "/services/accounts-receivable-management", permanent: true },
      { source: "/services/patient-collections", destination: "/services/complete-patient-billing", permanent: true },
      { source: "/services/revenue-cycle-management", destination: "/services/complete-rcm-services", permanent: true },
      { source: "/services/ehr-analytics", destination: "/our-process", permanent: true },
      { source: "/medical-billing-and-coding-services", destination: "/services/medical-billing-and-coding", permanent: true },
      { source: "/medical-accounts-receivable-services", destination: "/services/accounts-receivable-management", permanent: true },
      { source: "/credentialing-contracting", destination: "/services/credentialing-and-contracting", permanent: true },
      { source: "/out-of-network-negotiation", destination: "/services/out-of-network-negotiation", permanent: true },
      { source: "/eligibility-and-benefits-verification", destination: "/services/eligibility-and-benefits-verification", permanent: true },
      { source: "/complete-rcm-services", destination: "/services/complete-rcm-services", permanent: true },
      { source: "/healthcare-systems", destination: "/who-we-serve/healthcare-systems", permanent: true },
      { source: "/hospitals", destination: "/who-we-serve/hospitals", permanent: true },
      { source: "/emergency-rooms", destination: "/who-we-serve/emergency-rooms", permanent: true },
      { source: "/urgent-cares", destination: "/who-we-serve/urgent-cares", permanent: true },
      { source: "/private-practices", destination: "/who-we-serve/private-practices", permanent: true },
      { source: "/all-specialties", destination: "/specialties", permanent: true },
      { source: "/out-of-network", destination: "/services/out-of-network-negotiation", permanent: true },
    ];
  },
};

export default nextConfig;
