import type { CSSProperties, ReactNode } from "react";
import type { Ayah, Ui } from "@/lib/types";
import { numeral } from "@/lib/numerals";
import { ayahWords, splitLastWord } from "@/lib/reading-text";

export type InlineAyahProps = { ayah: Ayah; ui: Ui; marker?: ReactNode; reference?: ReactNode };
export function InlineAyah({ ayah, ui, marker, reference }: InlineAyahProps) {
  const [start, end] = splitLastWord(ayahWords(ayah.text));
  return <span className="huda-inline-ayah" data-ayah-key={ayah.key} style={{ "--tone": ui.icons.ayah.color } as CSSProperties}>
    {start}<span className="claim-ending">{end}{marker}</span>
    <span className="inline-ayah-reference">{reference ?? <bdi dir="ltr">{ayah.key.split(":").map((number) => numeral(Number(number))).join(":")}</bdi>}</span>
  </span>;
}
