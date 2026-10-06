import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import type { Ui } from "@/lib/types";
import { numeral } from "@/lib/numerals";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { SourceChip } from "@/components/ui/source-chip";
import { Band } from "./band";
import { PhoneFrame } from "./phone-frame";

/** Hero stage: brand label, display headline, core actions, proof row, and the product device screenshot. */
export function Hero({ ui, target, surahCount }: { ui: Ui; target: string; surahCount: number }) {
  return (
    <Band className="landing-hero-band" as="section">
      <div className="landing-hero-grid">
        <div className="landing-hero-text">
          <p className="landing-hero-label">{ui.app_name}</p>
          <h1 className="landing-hero-headline">{ui.landing.hero.lead}</h1>
          <p className="landing-hero-sub">{ui.landing.hero.sub}</p>
          <div className="landing-hero-actions">
            <Button asChild variant="pill" size="lg" className="landing-hero-btn">
              <a href={target}>
                {ui.landing.enter}
                <Icon icon={ArrowLeft01Icon} />
              </a>
            </Button>
            <a className="landing-guide-link" href={`${target}?guide=1`}>
              {ui.landing.guide_link}
            </a>
          </div>
          <div className="landing-hero-proof">
            <div className="landing-proof-item">
              <p className="landing-proof-count">{ui.landing.today.count.replace("{count}", numeral(surahCount))}</p>
            </div>
            <div className="landing-proof-item">
              <div className="landing-proof-chips" aria-label={ui.reader.choose_depth}>
                {ui.levels.map((level) => (
                  <span className="landing-proof-chip" key={level.depth}>{level.name}</span>
                ))}
              </div>
            </div>
            <div className="landing-proof-item">
              <div className="landing-proof-sources" aria-hidden="true">
                {ui.icon_order.map((kind) => (
                  <SourceChip kind={kind} ui={ui} size="small" key={kind} />
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="landing-hero-media">
          <PhoneFrame src="/landing/01-map.png" eager className="landing-hero-device" />
        </div>
      </div>
    </Band>
  );
}
