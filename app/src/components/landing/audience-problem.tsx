import type { Ui } from "@/lib/types";
import { Band } from "./band";
import { SectionHeader } from "./section-header";
import { Icon } from "@/components/ui/icon";
import {
  BookUserIcon,
  Unlink01Icon,
  LibraryIcon,
  ChartColumnIcon,
  Clock01Icon,
  HelpCircleIcon,
} from "@hugeicons/core-free-icons";

const PROBLEM_ICONS = [
  Unlink01Icon,
  LibraryIcon,
  ChartColumnIcon,
  Clock01Icon,
  HelpCircleIcon,
] as const;

/** Audience banner and problem cards: target reader banner followed by 5 compact problem cards with gold icon tiles. */
export function AudienceProblem({ ui }: { ui: Ui }) {
  return (
    <Band id="why" className="landing-why-band">
      <div className="landing-audience-banner">
        <div className="landing-icon-tile landing-icon-tile-accent" aria-hidden="true">
          <Icon icon={BookUserIcon} size={20} />
        </div>
        <div className="landing-audience-content">
          <p className="landing-audience-lead">{ui.landing.audience.body[0]}</p>
          {ui.landing.audience.body[1] && (
            <p className="landing-audience-sub">{ui.landing.audience.body[1]}</p>
          )}
        </div>
      </div>

      <SectionHeader title={ui.landing.problem.title} />

      <div className="landing-problem-grid">
        {ui.landing.problem.items.map((item, index) => {
          const ProblemIcon = PROBLEM_ICONS[index % PROBLEM_ICONS.length];
          return (
            <div className="landing-problem-card" key={item.title}>
              <div className="landing-icon-tile landing-icon-tile-gold" aria-hidden="true">
                <Icon icon={ProblemIcon} size={20} />
              </div>
              <h3 className="landing-problem-title">{item.title}</h3>
              <p className="landing-problem-body">{item.body}</p>
            </div>
          );
        })}
      </div>
    </Band>
  );
}
