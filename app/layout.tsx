import type { Metadata, Viewport } from "next";
import { Fredoka, Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const deploymentHost =
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.VERCEL_PROJECT_PRODUCTION_URL ??
  process.env.VERCEL_URL;

export const metadata: Metadata = {
  metadataBase: new URL(
    deploymentHost
      ? deploymentHost.startsWith("http")
        ? deploymentHost
        : `https://${deploymentHost}`
      : "http://localhost:3000",
  ),
  title: "Havoc — Your friends. Your chaos.",
  description: "Turn any camera, reaction, and group chat into a game.",
  openGraph: {
    title: "Havoc — Make the group chat playable",
    description: "Turn any camera, reaction, and group chat into a game.",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Havoc — Make the group chat playable",
    description: "Turn any camera, reaction, and group chat into a game.",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Havoc",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#fffaf0",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${fredoka.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
