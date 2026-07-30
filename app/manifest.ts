import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Havoc",
    short_name: "Havoc",
    description: "Turn any camera, reaction, and group chat into a game.",
    start_url: "/",
    display: "standalone",
    background_color: "#fffaf0",
    theme_color: "#fffaf0",
    orientation: "portrait",
    icons: [
      {
        src: "/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
