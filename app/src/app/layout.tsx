import type { Metadata, Viewport } from "next";
import { Readex_Pro, Amiri, Amiri_Quran, IBM_Plex_Sans_Arabic } from "next/font/google";
import type { ReactNode } from "react";
import { getUi } from "@/lib/content";
import { Disclosure } from "@/components/disclosure";
import { LegendTrigger } from "@/components/reader/legend-trigger";
import { SheetProvider } from "@/components/reader/sheet-provider";
import { Offline } from "@/components/offline";
import "./globals.css";

const body = IBM_Plex_Sans_Arabic({ weight: ["400", "500", "600", "700"], subsets: ["arabic"], display: "swap", variable: "--font-plex" });
const quran = Amiri_Quran({ weight: "400", subsets: ["arabic"], display: "swap", variable: "--font-amiri-quran" });
const quote = Amiri({ weight: "400", subsets: ["arabic"], display: "swap", variable: "--font-amiri" });
const comparison = Readex_Pro({ subsets: ["arabic"], display: "swap", variable: "--font-readex" });
export async function generateMetadata(): Promise<Metadata> {
  const ui = await getUi();
  return { title: { default: ui.app_name, template: `%s | ${ui.app_name}` }, description: ui.tagline,
    manifest: "/manifest.webmanifest", icons: { icon: "/icon.svg", apple: "/icon.svg" },
    applicationName: ui.app_name };
}
export const viewport: Viewport = {
  width: "device-width", initialScale: 1,
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f1eee4" }, { media: "(prefers-color-scheme: dark)", color: "#14161a" }],
};
export default async function RootLayout({ children }: { children: ReactNode }) {
  const ui = await getUi();
  return <html lang="ar" dir="rtl" className={`${body.variable} ${quran.variable} ${quote.variable} ${comparison.variable}`}>
    <body><SheetProvider ui={ui}><div className="page-shell"><main id="main-content">{children}</main><Disclosure ui={ui} /></div><LegendTrigger ui={ui} fixed /><Offline /></SheetProvider></body>
  </html>;
}
