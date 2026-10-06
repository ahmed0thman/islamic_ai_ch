import type { Ui } from "@/lib/types";
import { numeral } from "@/lib/numerals";
import { Band } from "./band";
import { SectionHeader } from "./section-header";
import { Icon } from "@/components/ui/icon";
import { Tick02Icon, Clock01Icon, CircleIcon } from "@hugeicons/core-free-icons";

/** Project status: three tiers of certainty (today, in progress, planned) with hanging-indent state icons. */
export function Status({ ui, count }: { ui: Ui; count: number }) {
  return (
    <Band id="status" className="landing-status-band">
      <SectionHeader number={4} title={ui.landing.nav.status} />
      <div className="landing-status-grid">
        <section className="landing-status-block" data-state="today">
          <div className="landing-status-head">
            <h3 className="landing-status-title">{ui.landing.today.title}</h3>
            <p className="landing-count">{ui.landing.today.count.replace("{count}", numeral(count))}</p>
          </div>
          <ul className="landing-rows">
            {ui.landing.today.items.map((item) => (
              <li key={item} className="landing-status-row">
                <span className="landing-status-icon landing-status-icon-today" aria-hidden="true">
                  <Icon icon={Tick02Icon} size={16} />
                </span>
                <span className="landing-status-text">{item}</span>
              </li>
            ))}
          </ul>
          <p className="landing-note">{ui.disclosure.ai}</p>
        </section>
        <section className="landing-status-block" data-state="progress">
          <div className="landing-status-head">
            <h3 className="landing-status-title">{ui.landing.in_progress.title}</h3>
          </div>
          <ul className="landing-rows">
            {ui.landing.in_progress.items.map((item) => (
              <li key={item} className="landing-status-row">
                <span className="landing-status-icon landing-status-icon-progress" aria-hidden="true">
                  <Icon icon={Clock01Icon} size={16} />
                </span>
                <span className="landing-status-text">{item}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="landing-status-block" data-state="planned">
          <div className="landing-status-head">
            <h3 className="landing-status-title">{ui.landing.planned.title}</h3>
          </div>
          <ul className="landing-rows">
            {ui.landing.planned.items.map((item) => (
              <li key={item} className="landing-status-row">
                <span className="landing-status-icon landing-status-icon-planned" aria-hidden="true">
                  <Icon icon={CircleIcon} size={16} />
                </span>
                <span className="landing-status-text">{item}</span>
              </li>
            ))}
          </ul>
          <p className="landing-note">{ui.landing.planned.note}</p>
        </section>
      </div>
    </Band>
  );
}
