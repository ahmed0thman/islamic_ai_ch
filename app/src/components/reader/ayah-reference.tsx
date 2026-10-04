"use client";

import { numeral } from "@/lib/numerals";
import type { Ayah, Ui } from "@/lib/types";

export type AyahReferenceProps = { ayah: Ayah; ui: Ui };
export function AyahReference({ ayah, ui }: AyahReferenceProps) {
  return <button type="button" className="ayah-reference-button" aria-label={`${ui.reader.ayahs_title} ${numeral(ayah.no)}`} onClick={(event) => {
    const candidates = Array.from(document.querySelectorAll<HTMLElement>("[data-ayah-key]"));
    const target = candidates.find((element) => element.dataset.ayahKey === ayah.key && element.closest(".ayah-stage") && element.getClientRects().length)
      ?? event.currentTarget.closest<HTMLElement>("[data-ayah-key]");
    target?.setAttribute("data-relation-highlight", "true");
    window.setTimeout(() => target?.removeAttribute("data-relation-highlight"), 200);
  }}><bdi dir="ltr">{ayah.key.split(":").map((number) => numeral(Number(number))).join(":")}</bdi></button>;
}
