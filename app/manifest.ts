export const dynamic = "force-static";

import type { MetadataRoute } from "next";

// Makes the site installable ("Add to Home Screen"): name, icon, opens full screen.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "לוח אימונים · הפועל באר שבע נוער",
    short_name: "לוח אימונים",
    description: "לוח האימונים והמשחקים של מחלקת הנוער",
    lang: "he",
    dir: "rtl",
    start_url: "/?source=app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fff8f6",
    theme_color: "#c8102e",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
