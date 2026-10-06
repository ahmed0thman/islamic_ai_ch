import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import type { SurahSummary, Ui } from "@/lib/types";
import { numeral } from "@/lib/numerals";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { SourceChip } from "@/components/ui/source-chip";

/** The introduction page at `/`: what huda is, what the AI does not do, and the published surahs as direct links. Every visible string comes from `ui.landing`; plain anchors keep every route reachable without prefetch. */
export function Landing({ ui, surahs }: { ui: Ui; surahs: SurahSummary[] }) {
  const target = `/s/${surahs[0].no}/`;
  return <div className="landing" aria-label={ui.landing.label}>
    <header className="landing-hero">
      <h1>{ui.app_name}</h1>
      <p className="landing-tagline">{ui.tagline}</p>
      <p className="landing-lead">{ui.landing.hero.lead}</p>
      <p className="landing-sub">{ui.landing.hero.sub}</p>
      <Button asChild variant="pill" size="lg"><a href={target}>{ui.landing.enter}<Icon icon={ArrowLeft01Icon} /></a></Button>
      <a className="landing-guide-link" href={`${target}?guide=1`}>{ui.landing.guide_link}</a>
    </header>
    <section className="landing-section">
      <h2>{ui.landing.audience.title}</h2>
      {ui.landing.audience.body.map((line) => <p key={line}>{line}</p>)}
    </section>
    <section className="landing-section">
      <h2>{ui.landing.problem.title}</h2>
      {ui.landing.problem.body.map((line) => <p key={line}>{line}</p>)}
    </section>
    <section className="landing-section landing-how">
      <h2>{ui.landing.how.title}</h2>
      <ol className="landing-cards">{ui.landing.how.items.map((item, index) => <li className="landing-card" key={item.title}>
        <h3>{item.title}</h3>
        <p>{item.body}</p>
        {index === 0 ? <span className="landing-chips">{ui.levels.map((level) => <span className="landing-chip" key={level.depth}>{level.name}</span>)}</span> : null}
        {index === 1 ? <span className="landing-chips" aria-hidden="true">{ui.icon_order.map((kind) => <SourceChip kind={kind} ui={ui} size="small" key={kind} />)}</span> : null}
      </li>)}</ol>
    </section>
    <section className="landing-section landing-ai">
      <h2>{ui.landing.ai.title}</h2>
      <ul className="landing-list">{ui.landing.ai.items.map((item) => <li key={item}>{item}</li>)}</ul>
      <p className="landing-note">{ui.landing.ai.note}</p>
    </section>
    <section className="landing-status">
      <div className="landing-status-block" data-state="today">
        <h2>{ui.landing.today.title}</h2>
        <p className="landing-count">{ui.landing.today.count.replace("{count}", numeral(surahs.length))}</p>
        <ul>{ui.landing.today.items.map((item) => <li key={item}>{item}</li>)}</ul>
        <p className="landing-note">{ui.disclosure.ai}</p>
      </div>
      <div className="landing-status-block" data-state="progress">
        <h2>{ui.landing.in_progress.title}</h2>
        <ul>{ui.landing.in_progress.items.map((item) => <li key={item}>{item}</li>)}</ul>
      </div>
      <div className="landing-status-block" data-state="planned">
        <h2>{ui.landing.planned.title}</h2>
        <ul>{ui.landing.planned.items.map((item) => <li key={item}>{item}</li>)}</ul>
        <p className="landing-note">{ui.landing.planned.note}</p>
      </div>
    </section>
    <nav className="landing-surahs" aria-label={ui.landing.surahs_title}>
      <h2>{ui.landing.surahs_title}</h2>
      {surahs.map((surah) => <a className="surah-switch-chip" href={`/s/${surah.no}/`} key={surah.no}>{surah.name}</a>)}
      <Button asChild variant="primary" size="lg"><a href={target}>{ui.landing.enter}<Icon icon={ArrowLeft01Icon} /></a></Button>
    </nav>
  </div>;
}
