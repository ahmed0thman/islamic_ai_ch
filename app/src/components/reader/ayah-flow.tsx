import type { CSSProperties } from "react";
import type { Ayah, Ui } from "@/lib/types";
import { numeral } from "@/lib/numerals";
import { ayahWords, splitLastWord } from "@/lib/reading-text";

/** A run of ayahs read as one continuous text, each ending in its number: one block, never a card per ayah. */
export function AyahFlow({ ayahs, ui }: { ayahs: Ayah[]; ui: Ui }) {
  return <section className="ayah-flow" aria-label={ui.reader.ayahs_title} style={{ "--tone": ui.icons.ayah.color } as CSSProperties}>
    <p className="ayah-flow-text">{ayahs.map((ayah) => {
      const [start, end] = splitLastWord(ayahWords(ayah.text));
      return <span key={ayah.key} data-ayah-key={ayah.key}>{start}<span className="claim-ending">{end}{"\u00a0"}<span className="ayah-gem">{numeral(ayah.no)}</span></span>{" "}</span>;
    })}</p>
  </section>;
}
