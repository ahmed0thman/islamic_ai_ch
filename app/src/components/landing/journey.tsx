import type { Ui } from "@/lib/types";
import { numeral } from "@/lib/numerals";
import { Band } from "./band";
import { SectionHeader } from "./section-header";
import { Icon } from "@/components/ui/icon";
import {
  HelpCircleIcon,
  Layers01Icon,
  BookOpen01Icon,
  CheckmarkBadge01Icon,
  AlertCircleIcon,
  Idea01Icon,
  Tick02Icon,
  Clock01Icon,
} from "@hugeicons/core-free-icons";

type JourneyItem = Ui["landing"]["journey"]["items"][number];

const KIND_ICONS = {
  question: HelpCircleIcon,
  science: Layers01Icon,
  term: BookOpen01Icon,
  state: CheckmarkBadge01Icon,
  misconception: AlertCircleIcon,
  example: Idea01Icon,
} as const;

function JourneySpecimen({ item }: { item: JourneyItem }) {
  switch (item.kind) {
    case "question":
      return (
        <div className="landing-journey-specimen">
          <span className="landing-specimen-ticket">
            <Icon icon={HelpCircleIcon} size={16} />
            <span>{item.tags[0]}</span>
          </span>
        </div>
      );
    case "science": {
      const tints = ["accent", "gold", "ink-3"] as const;
      return (
        <div className="landing-journey-specimen">
          {item.tags.map((tag, i) => (
            <span key={tag} className={`landing-specimen-chip landing-chip-${tints[i % tints.length]}`}>
              {tag}
            </span>
          ))}
        </div>
      );
    }
    case "term":
      return (
        <div className="landing-journey-specimen">
          {item.tags.map((tag) => (
            <span key={tag} className="landing-specimen-term">
              {tag}
            </span>
          ))}
        </div>
      );
    case "state":
      return (
        <div className="landing-journey-specimen">
          <span className="landing-specimen-badge-verified">
            <Icon icon={Tick02Icon} size={16} />
            <span>{item.tags[0]}</span>
          </span>
          {item.tags[1] && (
            <span className="landing-specimen-badge-pending">
              <Icon icon={Clock01Icon} size={16} />
              <span>{item.tags[1]}</span>
            </span>
          )}
        </div>
      );
    case "misconception":
      return (
        <div className="landing-journey-specimen">
          <span className="landing-specimen-badge-warning">
            <Icon icon={AlertCircleIcon} size={16} />
            <span>{item.tags[0]}</span>
          </span>
        </div>
      );
    case "example":
      return (
        <div className="landing-journey-specimen">
          <span className="landing-specimen-label-example">
            <Icon icon={Idea01Icon} size={16} />
            <span>{item.tags[0]}</span>
          </span>
        </div>
      );
  }
}

/** What the reader learns along the way: a 6-item card grid showing the tools and stages of understanding with live specimens. */
export function Journey({ ui }: { ui: Ui }) {
  return (
    <Band id="journey" className="landing-journey-band">
      <SectionHeader number={1} title={ui.landing.journey.title} />
      <p className="landing-journey-lead">{ui.landing.journey.lead}</p>
      <div className="landing-journey-grid">
        {ui.landing.journey.items.map((item, index) => {
          const itemNum = (index + 1 < 10 ? "٠" : "") + numeral(index + 1);
          const TileIcon = KIND_ICONS[item.kind];
          return (
            <div className="landing-journey-card" key={item.title}>
              <div className="landing-journey-card-top">
                <div className="landing-icon-tile landing-icon-tile-accent" aria-hidden="true">
                  <Icon icon={TileIcon} size={20} />
                </div>
                <span className="landing-journey-num" aria-hidden="true">{itemNum}</span>
              </div>
              <h3 className="landing-journey-title">{item.title}</h3>
              <p className="landing-journey-body">{item.body}</p>
              <JourneySpecimen item={item} />
            </div>
          );
        })}
      </div>
    </Band>
  );
}
