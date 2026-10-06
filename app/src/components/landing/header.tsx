import type { Ui } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./theme-toggle";

/** Sticky site header with brand, section anchors, theme switcher, and primary entry button. */
export function Header({ ui, target }: { ui: Ui; target: string }) {
  return (
    <header className="landing-header">
      <div className="landing-container landing-header-inner">
        <a href="/" className="landing-brand" aria-label={ui.app_name}>
          <span className="landing-brand-name">{ui.app_name}</span>
        </a>
        <nav className="landing-header-nav" aria-label={ui.landing.nav.label}>
          <a href="#journey" className="landing-nav-link">{ui.landing.nav.journey}</a>
          <a href="#how" className="landing-nav-link">{ui.landing.nav.how}</a>
          <a href="#trust" className="landing-nav-link">{ui.landing.nav.trust}</a>
          <a href="#status" className="landing-nav-link">{ui.landing.nav.status}</a>
          <a href="#surahs" className="landing-nav-link">{ui.landing.nav.surahs}</a>
        </nav>
        <div className="landing-header-actions">
          <ThemeToggle ui={ui} />
          <Button asChild variant="primary" size="sm" className="landing-header-enter">
            <a href={target}>{ui.landing.enter}</a>
          </Button>
        </div>
      </div>
    </header>
  );
}
