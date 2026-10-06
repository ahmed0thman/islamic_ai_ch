import type { Ui } from "@/lib/types";

/** Who the reader is for and the problem it solves: two calm columns on wide screens, stacked on phones. The problem lines render as hairline rows, not another wall of text. */
export function AudienceProblem({ ui }: { ui: Ui }) {
  return <section className="landing-band landing-reveal">
    <div className="landing-band-col">
      <h2 className="landing-h2">{ui.landing.audience.title}</h2>
      {ui.landing.audience.body.map((line) => <p className="landing-body" key={line}>{line}</p>)}
    </div>
    <div className="landing-band-col">
      <h2 className="landing-h2">{ui.landing.problem.title}</h2>
      <ul className="landing-rows">{ui.landing.problem.body.map((line) => <li key={line}>{line}</li>)}</ul>
    </div>
  </section>;
}
