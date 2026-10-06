import type { Ui } from "@/lib/types";
import { numeral } from "@/lib/numerals";
import { SourceChip } from "@/components/ui/source-chip";
import { Band } from "./band";
import { SectionHeader } from "./section-header";
import { PhoneFrame } from "./phone-frame";

const SHOTS = [null, "/landing/03-source.png", "/landing/05-reading.png", "/landing/04-ask.png"] as const;

/** A still specimen of the reader's depth dial, drawn from the configured level names. */
function DepthDial({ ui }: { ui: Ui }) {
  return (
    <ol className="landing-dial" aria-hidden="true">
      {ui.levels.map((level, index) => (
        <li className="landing-dial-notch" data-current={index === 1 ? "" : undefined} key={level.depth}>
          {level.name}
        </li>
      ))}
    </ol>
  );
}

/** How it works: four features with alternating text and media panels, each preceded by a numeral. */
export function How({ ui }: { ui: Ui }) {
  return (
    <Band id="how" className="landing-how-band">
      <SectionHeader number={2} title={ui.landing.how.title} />
      <ol className="landing-features">
        {ui.landing.how.items.map((item, index) => {
          const shot = SHOTS[index % SHOTS.length];
          const featureNum = (index + 1 < 10 ? "٠" : "") + numeral(index + 1);
          return (
            <li className="landing-feature" key={item.title}>
              <div className="landing-feature-text">
                <span className="landing-feature-num" aria-hidden="true">{featureNum}</span>
                <h3 className="landing-feature-title">{item.title}</h3>
                <p className="landing-feature-desc">{item.body}</p>
                {index === 1 ? (
                  <span className="landing-source-chips" aria-hidden="true">
                    {ui.icon_order.map((kind) => (
                      <SourceChip kind={kind} ui={ui} key={kind} />
                    ))}
                  </span>
                ) : null}
              </div>
              <div className="landing-feature-media-col">
                <div className={`landing-feature-panel ${shot ? "" : "landing-feature-panel-dial"}`}>
                  {shot ? (
                    <PhoneFrame src={shot} className="landing-feature-device" />
                  ) : (
                    <DepthDial ui={ui} />
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </Band>
  );
}
