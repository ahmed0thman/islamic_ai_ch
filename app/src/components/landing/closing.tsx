import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import type { SurahSummary, Ui } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

/** The close: the published surahs as direct links (the reader's own chip style), then the entry button once more. */
export function Closing({ ui, surahs, target }: { ui: Ui; surahs: SurahSummary[]; target: string }) {
  return <nav className="landing-closing landing-reveal" aria-label={ui.landing.surahs_title}>
    <h2 className="landing-h2">{ui.landing.surahs_title}</h2>
    <div className="landing-chips">{surahs.map((surah) => <a className="surah-switch-chip" href={`/s/${surah.no}/`} key={surah.no}>{surah.name}</a>)}</div>
    <Button asChild variant="primary" size="lg"><a href={target}>{ui.landing.enter}<Icon icon={ArrowLeft01Icon} /></a></Button>
  </nav>;
}
