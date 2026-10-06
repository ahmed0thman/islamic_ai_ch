import type { Ui } from "@/lib/types";
import { numeral } from "@/lib/numerals";

/** Where the project stands: three tiers of certainty — a raised card for what works today, a soft card for what is in progress, a dashed outline for the plan. The count slot is filled from the published list. */
export function Status({ ui, count }: { ui: Ui; count: number }) {
  return <div className="landing-status landing-reveal">
    <section className="landing-status-block" data-state="today">
      <h2>{ui.landing.today.title}</h2>
      <p className="landing-count">{ui.landing.today.count.replace("{count}", numeral(count))}</p>
      <ul className="landing-rows">{ui.landing.today.items.map((item) => <li key={item}>{item}</li>)}</ul>
      <p className="landing-note">{ui.disclosure.ai}</p>
    </section>
    <section className="landing-status-block" data-state="progress">
      <h2>{ui.landing.in_progress.title}</h2>
      <ul className="landing-rows">{ui.landing.in_progress.items.map((item) => <li key={item}>{item}</li>)}</ul>
    </section>
    <section className="landing-status-block" data-state="planned">
      <h2>{ui.landing.planned.title}</h2>
      <ul className="landing-rows">{ui.landing.planned.items.map((item) => <li key={item}>{item}</li>)}</ul>
      <p className="landing-note">{ui.landing.planned.note}</p>
    </section>
  </div>;
}
