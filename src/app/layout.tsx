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
import { SiteAnalytics } from "@/components/analytics";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: site.name,
  category: "Medical billing and revenue cycle management",
  authors: [{ name: site.name, url: SITE_URL }],
  creator: site.name,
  publisher: site.name,
  formatDetection: { telephone: true, address: true, email: true },
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
    title: "Knight Medical Billing | Medical Billing & Revenue Cycle Management",
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


export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-US" suppressHydrationWarning>
      <head>
        <script
          // Runs before first paint so the saved theme applies without a flash.
          dangerouslySetInnerHTML={{
            __html: `(function(){try{
  var p=JSON.parse(localStorage.getItem("kmb-prefs")||"{}");
  var r=document.documentElement;
  var dark=p.theme==="dark"||(!p.theme&&window.matchMedia("(prefers-color-scheme: dark)").matches);
  if(dark)r.classList.add("dark");
  r.style.colorScheme=dark?"dark":"light";
  if(p.contrast)r.dataset.contrast=p.contrast;
  if(p.textSize)r.dataset.textsize=p.textSize;
  if(p.motion)r.dataset.motion=p.motion;
  var reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var seen=false;try{seen=sessionStorage.getItem("kmb-intro-seen")==="1";}catch(e){}
  var intro="off";
  if(location.pathname==="/"&&!reduced&&p.motion!=="reduced"){intro=seen?"brief":"full";}
  r.dataset.intro=intro;
}catch(e){try{document.documentElement.dataset.intro="off";}catch(ignore){}}})();`,
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
        <JsonLd data={[organizationSchema(), websiteSchema()]} />
      <SiteAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />
      </body>
    </html>
  );
}
