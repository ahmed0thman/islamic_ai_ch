import { getUi, getIndex } from "@/lib/content";
import { Landing } from "@/components/landing/landing";

/**
 * The introduction page. It lists the published surahs and links into the reader; a returning visitor reaches reading from the first screen, a surah chip, or any `/s/<no>/` link. No automatic redirect: a script redirect flashes the page, and a judge who returns must still be able to see it.
 */
export default async function Home() {
  const [ui, index] = await Promise.all([getUi(), getIndex()]);
  return <Landing ui={ui} surahs={index.surahs} />;
}
