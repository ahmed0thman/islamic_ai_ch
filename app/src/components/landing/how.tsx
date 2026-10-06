import type { Ui } from "@/lib/types";
import { SourceChip } from "@/components/ui/source-chip";
import { PhoneFrame } from "./phone-frame";

/* Each feature shows the product beside its text, matched by position in `how.items`: the depth dial (drawn from `ui.levels`, like the reader's control), then the source panel, the term in the text, and Ask. */
const SHOTS = [null, "/landing/03-source.png", "/landing/05-reading.png", "/landing/04-ask.png"] as const;

/** A still of the reader's depth dial, drawn from the same level names. Decorative: the feature text names the four degrees. */
function DepthDial({ ui }: { ui: Ui }) {
  return <ol className="landing-dial" aria-hidden="true">{ui.levels.map((level, index) =>
    <li className="landing-dial-notch" data-current={index === 1 ? "" : undefined} key={level.depth}>{level.name}</li>)}</ol>;
}

/** The heart of the page: the four features, alternating text and product on wide screens. */
export function How({ ui }: { ui: Ui }) {
  return <section className="landing-how landing-reveal">
    <h2 className="landing-h2">{ui.landing.how.title}</h2>
    <ol className="landing-features">{ui.landing.how.items.map((item, index) => {
      const shot = SHOTS[index % SHOTS.length];
      return <li className="landing-feature" key={item.title}>
        <div className="landing-feature-text">
          <h3>{item.title}</h3>
          <p>{item.body}</p>
          {index === 1 ? <span className="landing-source-chips" aria-hidden="true">{ui.icon_order.map((kind) => <SourceChip kind={kind} ui={ui} key={kind} />)}</span> : null}
        </div>
        {shot ? <PhoneFrame src={shot} className="landing-feature-media" /> : <span className="landing-feature-media"><DepthDial ui={ui} /></span>}
      </li>;
    })}</ol>
  </section>;
}
