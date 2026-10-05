import { getUi } from "@/lib/content";
import { publishedSurahs } from "@/lib/published";
import { ReplaceLocation } from "@/components/replace-location";

/**
 * The first screen is the first published surah; a new reader starts at the understanding depth (the reader's default) and a saved depth is kept. The others are reached from the reader's surah chips.
 * A static export cannot send an HTTP redirect, and `redirect()` there leaves an error shell that only scripts resolve, so the page
 * carries a meta refresh (no script needed), a client replace (instant) and a plain link (last resort).
 */
export default async function Home() {
  const ui = await getUi();
  const target = `/s/${publishedSurahs[0]}/`;
  return <>
    <meta httpEquiv="refresh" content={`0;url=${target}`} />
    <ReplaceLocation to={target} />
    <p className="home-redirect"><a href={target}>{ui.app_name}</a></p>
  </>;
}
