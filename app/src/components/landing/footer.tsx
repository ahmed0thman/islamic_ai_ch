import type { Ui } from "@/lib/types";
import { Band } from "./band";

/** Site footer: brand, tagline, reader links, and source attribution note. */
export function Footer({ ui, target }: { ui: Ui; target: string }) {
  return (
    <Band as="footer" className="landing-footer-band">
      <div className="landing-footer-row">
        <div className="landing-footer-brand-col">
          <a href="/" className="landing-footer-brand" aria-label={ui.app_name}>
            <span className="landing-brand-name">{ui.app_name}</span>
          </a>
          <p className="landing-footer-tagline">{ui.tagline}</p>
        </div>
        <div className="landing-footer-links">
          <a className="landing-footer-link" href={target}>{ui.landing.enter}</a>
          <a className="landing-footer-link" href={`${target}?guide=1`}>{ui.landing.guide_link}</a>
        </div>
      </div>
      <p className="landing-footer-note">{ui.landing.footer.note}</p>
    </Band>
  );
}
