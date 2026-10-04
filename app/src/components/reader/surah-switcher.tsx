import Link from "next/link";
import type { SurahSummary, Ui } from "@/lib/types";

export type SurahSwitcherProps = { surahs: SurahSummary[]; current: number; ui: Ui };
export function SurahSwitcher({ surahs, current, ui }: SurahSwitcherProps) {
  return <nav className="surah-switcher" aria-label={ui.reader.surahs_title}>{surahs.map((surah) => <Link key={surah.no} href={`/s/${surah.no}/`} prefetch={false} aria-current={surah.no === current ? "page" : undefined} className="surah-switch-chip">{surah.name}</Link>)}</nav>;
}
