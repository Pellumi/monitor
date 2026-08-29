import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return { name: "Tellann", short_name: "Tellann", description: "Behavioral QA and software quality intelligence.", start_url: "/", display: "standalone", background_color: "#000000", theme_color: "#000000", icons: [{ src: "/logo_icon.svg", sizes: "any", type: "image/svg+xml" }] };
}
