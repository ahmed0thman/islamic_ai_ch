import type { Metadata, Viewport } from "next";
import { Noto_Naskh_Arabic, Amiri_Quran } from "next/font/google";
import type { ReactNode } from "react";
import { getUi } from "@/lib/content";
import { Disclosure } from "@/components/disclosure";
import { Legend } from "@/components/legend";
import { Offline } from "@/components/offline";
import "./globals.css";

const body = Noto_Naskh_Arabic({ subsets: ["arabic"], display: "swap", variable: "--font-body" });
const quran = Amiri_Quran({ weight: "400", subsets: ["arabic"], display: "swap", variable: "--font-quran" });
export async function generateMetadata(): Promise<Metadata> {
  const ui = await getUi();
  return { title: { default: ui.app_name, template: `%s | ${ui.app_name}` }, description: ui.tagline,
    manifest: "/manifest.webmanifest", icons: { icon: "/icon.svg", apple: "/icon.svg" },
    applicationName: ui.app_name };
}
export const viewport: Viewport = {
  width: "device-width", initialScale: 1,
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f8f5ee" }, { media: "(prefers-color-scheme: dark)", color: "#151e1b" }],
};
export default async function RootLayout({ children }: { children: ReactNode }) {
  const ui = await getUi();
  return <html lang="ar" dir="rtl" className={`${body.variable} ${quran.variable}`}>
    <body><div className="page-shell"><main id="main-content">{children}</main><Disclosure ui={ui} /></div><Legend ui={ui} /><Offline /></body>
  </html>;
}
