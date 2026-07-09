import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "./theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { DialogProvider } from "@/components/ui/dialog-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "MarketFit — Own Your Next Role",
    template: "%s · MarketFit",
  },
  description:
    "AI-powered career platform: precision job matching, resume tailoring, ATS scoring, visa intelligence, and one-click application autofill. Built for international students and job seekers who play to win.",
  applicationName: "MarketFit",
  keywords: ["job search", "resume tailoring", "ATS score", "H1B sponsorship jobs", "OPT CPT jobs", "application autofill", "cover letter generator", "AI resume builder"],
  openGraph: {
    type: "website",
    siteName: "MarketFit",
    url: SITE_URL,
    title: "MarketFit — Own Your Next Role",
    description: "Tailor resumes in 12s, autofill any application in one click, and find visa-friendly jobs — all in one place.",
  },
  twitter: {
    card: "summary_large_image",
    title: "MarketFit — Own Your Next Role",
    description: "Tailor resumes in 12s, autofill any application in one click, and find visa-friendly jobs — all in one place.",
  },
  robots: { index: true, follow: true },
};

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
      <head>
        {/* Clash Display + Satoshi for the MarketFit landing page */}
        <link
          rel="preconnect"
          href="https://api.fontshare.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://api.fontshare.com/v2/css?f[]=clash-display@400,500,600,700&f[]=satoshi@300,400,500,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <DialogProvider>{children}</DialogProvider>
        </ThemeProvider>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
