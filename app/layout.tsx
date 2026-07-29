import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Havoc — Complete Interactive App Layout",
  description: "Explore 21 main screens across onboarding, parties, live games, Highlights, progression, settings, and safety.",
  openGraph: {
    title: "Havoc — Make the group chat playable",
    description: "Explore the complete 21-screen interactive app layout.",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Havoc — Make the group chat playable",
    description: "Explore the complete 21-screen interactive app layout.",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
