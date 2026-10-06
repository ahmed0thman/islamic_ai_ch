import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import type { SurahSummary, Ui } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Band } from "./band";
import { SectionHeader } from "./section-header";

/** Published surahs and closing call: dark stage bookending the hero, data-driven surah links, and entry button. */
export function Closing({ ui, surahs, target }: { ui: Ui; surahs: SurahSummary[]; target: string }) {
  return (
    <Band id="surahs" className="landing-closing-band" as="section" aria-label={ui.landing.surahs_title}>
      <div className="landing-closing-content">
        <SectionHeader number={5} title={ui.landing.surahs_title} className="landing-closing-header" />
        <div className="landing-chips">
          {surahs.map((surah) => (
            <a className="landing-surah-chip" href={`/s/${surah.no}/`} key={surah.no}>
              {surah.name}
            </a>
          ))}
        </div>
        <div className="landing-closing-action">
          <Button asChild variant="pill" size="lg" className="landing-closing-btn">
            <a href={target}>
              {ui.landing.enter}
              <Icon icon={ArrowLeft01Icon} />
            </a>
          </Button>
        </div>
      </div>
    </Band>
  );
}
