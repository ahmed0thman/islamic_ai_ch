import type { SurahSummary, Ui } from "@/lib/types";
import { Header } from "./header";
import { Hero } from "./hero";
import { AudienceProblem } from "./audience-problem";
import { Journey } from "./journey";
import { How } from "./how";
import { Trust } from "./trust";
import { Status } from "./status";
import { Closing } from "./closing";
import { Footer } from "./footer";

/** The introduction page at `/`: sticky header, hero stage, why, journey, how, trust, status, surahs, and footer. */
export function Landing({ ui, surahs }: { ui: Ui; surahs: SurahSummary[] }) {
  const target = `/s/${surahs[0].no}/`;
  return (
    <div className="landing" aria-label={ui.landing.label}>
      <Header ui={ui} target={target} />
      <Hero ui={ui} target={target} surahCount={surahs.length} />
      <AudienceProblem ui={ui} />
      <Journey ui={ui} />
      <How ui={ui} />
      <Trust ui={ui} />
      <Status ui={ui} count={surahs.length} />
      <Closing ui={ui} surahs={surahs} target={target} />
      <Footer ui={ui} target={target} />
    </div>
  );
}
