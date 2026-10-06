import { ArrowUpRight01Icon, BookOpen01Icon, Quran01Icon, QuillWrite01Icon } from "@hugeicons/core-free-icons";
import type { Ui } from "@/lib/types";
import { Icon } from "@/components/ui/icon";
import { Band } from "./band";
import { SectionHeader } from "./section-header";

const COMMITMENTS = [Quran01Icon, BookOpen01Icon, QuillWrite01Icon, ArrowUpRight01Icon] as const;

/** Trust and boundaries: what the AI does not do, four commitment cards, and the integrity note. */
export function Trust({ ui }: { ui: Ui }) {
  return (
    <Band id="trust" className="landing-trust-band">
      <SectionHeader number={3} title={ui.landing.ai.title} />
      <ul className="landing-trust-grid">
        {ui.landing.ai.items.map((item, index) => (
          <li className="landing-trust-card" key={item}>
            <span className="landing-trust-icon" aria-hidden="true">
              <Icon icon={COMMITMENTS[index % COMMITMENTS.length]} size={20} />
            </span>
            <p className="landing-trust-text">{item}</p>
          </li>
        ))}
      </ul>
      <p className="landing-trust-note">{ui.landing.ai.note}</p>
    </Band>
  );
}
