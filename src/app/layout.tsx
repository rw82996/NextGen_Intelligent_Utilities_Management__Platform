import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GridNextGen — Intelligent Utilities Management Platform",
  description: "AI-Native Energy Grid & Utilities Operations, Forecasting, and Edge Analytics Platform",
};

// Base path prefix (matches next.config.ts) so the COI service worker resolves
// correctly under the GitHub Pages sub-path.
const basePrefix =
  process.env.GITHUB_ACTIONS === "true" ? "/NextGen_Intelligent_Utilities_Management__Platform" : "";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Script src={`${basePrefix}/coi-serviceworker.js`} strategy="beforeInteractive" />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
