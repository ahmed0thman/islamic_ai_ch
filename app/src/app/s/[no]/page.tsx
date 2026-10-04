import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getIndex, getSurah, getUi } from "@/lib/content";
import { Reader } from "@/components/reader/reader";

export const dynamicParams = false;
export async function generateStaticParams() {
  const index = await getIndex();
  // Validate every exported surah before any static pages are produced.
  await Promise.all(index.surahs.map(async (item) => {
    const surah = await getSurah(item.no);
    if (surah.surah.name !== item.name || surah.surah.ayah_count !== item.ayah_count) {
      throw new Error(`Index metadata differs from surah-${item.no}.json`);
    }
  }));
  return index.surahs.map((item) => ({ no: String(item.no) }));
}
async function load(params: Promise<{ no: string }>) {
  const { no } = await params;
  const index = await getIndex();
  if (!/^[1-9]\d{0,2}$/.test(no) || !index.surahs.some((item) => item.no === Number(no))) notFound();
  return getSurah(Number(no));
}
export async function generateMetadata({ params }: { params: Promise<{ no: string }> }): Promise<Metadata> {
  return { title: (await load(params)).surah.name };
}
export default async function SurahPage({ params }: { params: Promise<{ no: string }> }) {
  const [surah, ui, index] = await Promise.all([load(params), getUi(), getIndex()]);
  const position = index.surahs.findIndex((item) => item.no === surah.surah.no);
  const nextSurah = index.surahs[position + 1];
  if (process.env.HUDA_ASK === "1") {
    const { AskBox } = await import("@/components/ask-box");
    return <><Reader key={surah.surah.no} surah={surah} ui={ui} surahs={index.surahs} nextSurah={nextSurah} /><AskBox key={surah.surah.no} surah={surah} ui={ui} /></>;
  }
  return <Reader key={surah.surah.no} surah={surah} ui={ui} surahs={index.surahs} nextSurah={nextSurah} />;
}
