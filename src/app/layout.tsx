import type { Metadata, Viewport } from "next";
import { DM_Sans, Inter, JetBrains_Mono, Lora, Manrope, Playfair_Display } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "./theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { DialogProvider } from "@/components/ui/dialog-provider";
import GlobalThemeToggle from "./global-theme-toggle";\nimport { ExperienceProvider } from "@/experience/experience-provider";\nimport { WebVitalsReporter } from "@/experience/web-vitals-reporter";

// One pairing, each face with one job, so a page never has to choose:
// a serif for titles, an italic serif only for a short emphasised word, a humanist sans for
// reading, a geometric sans for labels and pills, and a tight grotesk for numbers and the
// single strong button. Monospace is left for code.
const display = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

const accent = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["600", "700"],
  style: ["italic"],
});

const body = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const label = DM_Sans({
  variable: "--font-dmsans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const numeric = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
});

const mono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  colorScheme: "light dark",
};

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
      className={`${display.variable} ${accent.variable} ${body.variable} ${label.variable} ${numeric.variable} ${mono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      {/* suppressHydrationWarning: browser extensions (e.g. JobRight injects
          jf-observer-attached on <body>) mutate the DOM before React hydrates,
          which is harmless but otherwise throws a hydration mismatch error. */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <ThemeProvider>
          <ExperienceProvider>
            <WebVitalsReporter />
            <GlobalThemeToggle />
            <DialogProvider>{children}</DialogProvider>
          </ExperienceProvider>
        </ThemeProvider>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}