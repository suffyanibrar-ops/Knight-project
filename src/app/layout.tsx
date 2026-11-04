import "@fontsource-variable/manrope";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { ToastProvider } from "@/components/motion/toast";
import { MotionProvider } from "@/components/motion/motion-provider";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { site } from "@/lib/site";
import { organizationSchema, websiteSchema, SITE_URL } from "@/lib/seo";
import { JsonLd } from "@/components/structured-data";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: site.name,
  category: "Medical billing and revenue cycle management",
  authors: [{ name: site.name, url: SITE_URL }],
  creator: site.name,
  publisher: site.name,
  formatDetection: { telephone: true, address: true, email: true },
  alternates: { canonical: SITE_URL },
  title: {
    default: "Knight Medical Billing | Custom Tailored Medical Billing & RCM",
    template: "%s | Knight Medical Billing",
  },
  description: site.description,
  keywords: [
    "medical billing services",
    "medical billing and coding",
    "accounts receivable management",
    "out-of-network negotiation",
    "credentialing and contracting",
    "revenue cycle management",
    "eligibility and benefits verification",
    "revenue cycle management company",
    "Knight Medical Billing",
  ],
  openGraph: {
    title: "Knight Medical Billing | 99.9% Claim Acceptance Rate",
    description: site.description,
    url: site.url,
    siteName: site.name,
    images: [{ url: "/images/og-knight-medical-billing.jpg", width: 1200, height: 630, alt: "Knight Medical Billing — custom tailored medical billing and RCM" }],
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Knight Medical Billing | Custom Tailored Medical Billing & RCM",
    description: site.description,
    images: ["/images/og-knight-medical-billing.jpg"],
  },
  icons: { icon: "/icon.png", apple: "/icon.png" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#071f2f",
  width: "device-width",
  initialScale: 1,
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  name: site.name,
  description: site.description,
  url: site.url,
  telephone: site.phone,
  email: site.email,
  image: `${site.url}/images/og-knight-medical-billing.jpg`,
  logo: `${site.url}${site.logo}`,
  priceRange: "No prepayment, no hidden fees",
  address: {
    "@type": "PostalAddress",
    streetAddress: "585 Grove St Ste 145",
    addressLocality: "Herndon",
    addressRegion: "VA",
    postalCode: "20170",
    addressCountry: "US",
  },
  areaServed: "United States",
  knowsSpecialty: ["Medical Billing and Coding", "Accounts Receivable Management", "Credentialing and Contracting", "Out-of-Network Negotiation", "Eligibility and Benefits Verification", "Revenue Cycle Management"],
  openingHours: "Mo-Fr 08:00-17:00",
  slogan: "You heal. Leave the revenue management to us.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          // Runs before first paint so the saved theme applies without a flash.
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var p=JSON.parse(localStorage.getItem("kmb-prefs")||"{}");var d=p.theme==="dark"||(!p.theme&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;if(d)r.classList.add("dark");r.style.colorScheme=d?"dark":"light";if(p.contrast)r.dataset.contrast=p.contrast;if(p.textSize)r.dataset.textsize=p.textSize;if(p.motion)r.dataset.motion=p.motion;}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-screen bg-surface text-ink-900 antialiased">
        <ThemeProvider>
          <MotionProvider>
            <ToastProvider>
              {/* Site chrome (header/footer/chat) lives in the (site) layout so the
                  admin console renders without it. */}
              {children}
            </ToastProvider>
          </MotionProvider>
        </ThemeProvider>
        <JsonLd data={[jsonLd, organizationSchema(), websiteSchema()]} />
      </body>
    </html>
  );
}
