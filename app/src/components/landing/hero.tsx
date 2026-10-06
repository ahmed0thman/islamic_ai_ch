import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import type { Ui } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { PhoneFrame } from "./phone-frame";

/** The first screen: the brand on the product's dark stage, the entry button and the guide link, and the app itself in a phone frame beside the words on wide screens, below them on phones. */
export function Hero({ ui, target }: { ui: Ui; target: string }) {
  return <header className="landing-hero">
    <div className="landing-hero-text">
      <h1 className="landing-name">{ui.app_name}</h1>
      <p className="landing-tagline">{ui.tagline}</p>
      <p className="landing-lead">{ui.landing.hero.lead}</p>
      <p className="landing-sub">{ui.landing.hero.sub}</p>
      <div className="landing-hero-actions">
        <Button asChild variant="pill" size="lg"><a href={target}>{ui.landing.enter}<Icon icon={ArrowLeft01Icon} /></a></Button>
        <a className="landing-guide-link" href={`${target}?guide=1`}>{ui.landing.guide_link}</a>
      </div>
    </div>
    <PhoneFrame src="/landing/01-map.png" eager className="landing-hero-device" />
  </header>;
}
