import { ArrowUpRight01Icon, BookOpen01Icon, Quran01Icon, QuillWrite01Icon } from "@hugeicons/core-free-icons";
import type { Ui } from "@/lib/types";
import { Icon } from "@/components/ui/icon";

/* One quiet stroke icon per commitment, all from the project's icon set, matched by position in `ai.items`. */
const COMMITMENTS = [Quran01Icon, BookOpen01Icon, QuillWrite01Icon, ArrowUpRight01Icon] as const;

/** What the AI does not do here: a tinted trust band, four commitments in a grid, then the note. */
export function Trust({ ui }: { ui: Ui }) {
  return <section className="landing-trust landing-reveal">
    <h2 className="landing-h2">{ui.landing.ai.title}</h2>
    <ul className="landing-trust-grid">{ui.landing.ai.items.map((item, index) => <li key={item}>
      <span className="landing-trust-icon" aria-hidden="true"><Icon icon={COMMITMENTS[index % COMMITMENTS.length]} size={20} /></span>
      <p>{item}</p>
    </li>)}</ul>
    <p className="landing-trust-note">{ui.landing.ai.note}</p>
  </section>;
}
