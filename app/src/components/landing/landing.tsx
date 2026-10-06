import type { SurahSummary, Ui } from "@/lib/types";
import { Hero } from "./hero";
import { AudienceProblem } from "./audience-problem";
import { How } from "./how";
import { Trust } from "./trust";
import { Status } from "./status";
import { Closing } from "./closing";

/** The introduction page at `/`: one section per component, every visible string from `ui.landing` (plus the app name, tagline, level names and the source chips' dictionary). Plain anchors keep every route reachable without prefetch. */
export function Landing({ ui, surahs }: { ui: Ui; surahs: SurahSummary[] }) {
  const target = `/s/${surahs[0].no}/`;
  return <div className="landing" aria-label={ui.landing.label}>
    <Hero ui={ui} target={target} />
    <AudienceProblem ui={ui} />
    <How ui={ui} />
    <Trust ui={ui} />
    <Status ui={ui} count={surahs.length} />
    <Closing ui={ui} surahs={surahs} target={target} />
  </div>;
}
