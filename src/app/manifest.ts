import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Knight Medical Billing",
    short_name: "Knight Billing",
    description: "Custom tailored medical billing and revenue cycle management for hospitals, healthcare systems, ERs, urgent cares and private practices.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#071f2f",
    icons: [
      { src: "/icon.png", sizes: "180x180", type: "image/png", purpose: "any" },
      { src: "/images/knight-mark.png", sizes: "640x640", type: "image/png", purpose: "maskable" },
    ],
  };
}
