import Link from "next/link";
import { ArrowLeft01Icon, BookOpen01Icon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/ui/icon";
import { getIndex, getUi } from "@/lib/content";
import { numeral } from "@/lib/numerals";

export default async function Home() {
  const [index, ui] = await Promise.all([getIndex(), getUi()]);
  return <>
    <header className="home-header"><div className="book-emblem" aria-hidden="true"><Icon icon={BookOpen01Icon} size={24} /></div><h1>{ui.app_name}</h1><p className="tagline">{ui.tagline}</p></header>
    <section className="surah-library" aria-labelledby="surahs-title">
      <h2 id="surahs-title" className="eyebrow">{ui.reader.surahs_title}</h2>
      <ul className="surah-list">{index.surahs.map((surah) => <li key={surah.no}>
        <Link href={`/s/${surah.no}/`} prefetch={false} className="surah-card">
          <span className="surah-number">{numeral(surah.no)}</span>
          <span className="surah-card-title">{surah.name}</span>
          <span className="surah-count">{ui.reader.ayahs_title} <b>{numeral(surah.ayah_count)}</b></span>
          <Icon icon={ArrowLeft01Icon} className="card-arrow" />
        </Link>
      </li>)}</ul>
    </section>
  </>;
}
