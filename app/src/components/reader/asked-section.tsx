"use client";

import { useId, useRef } from "react";
import { askedAt } from "@/lib/asked";
import { Button } from "@/components/ui/button";
import { blockRole, displaySegments, drawingFor } from "@/lib/ask-client";
import { ParagraphView } from "./paragraph-view";
import { SourceAtomRow } from "./source-atom-row";
import { useReading } from "./reading-context";
import { useAsk } from "./ask-state";

/**
 * What the reader asked themself, in the place they asked it: the questions of this stop at this depth, or, with `stop` null, those asked with no stop open.
 * The answer is the same sentences with their marks. It is told apart by a continuous gold edge and a small title, with no card, no shadow, and nothing of a quote or an example.
 */
export function AskedSection({ stop }: { stop: number | null }) {
  const ask = useAsk();
  const { relations: _relations, ...reading } = useReading();
  const heading = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  if (!ask) return null;
  const entries = askedAt(ask.entries, ask.depth, stop);
  if (!entries.length) return null;
  const { ui } = reading;
  function remove(id: string, last: boolean) {
    ask!.remove(id);
    // The pressed button is gone: keep focus in the reading instead of dropping it.
    window.requestAnimationFrame(() => {
      if (!last) heading.current?.focus({ preventScroll: true });
      else document.querySelector<HTMLElement>("[data-scene-heading]")?.focus({ preventScroll: true });
    });
  }
  return <section className="asked" aria-labelledby={titleId}>
    <h3 className="asked-title" id={titleId} ref={heading} tabIndex={-1}>{ui.ask.your_questions}</h3>
    <ul className="asked-list">{entries.map(({ item, atoms }) => <li className="asked-item" key={item.id}>
      <p className="asked-label">{ui.ask.your_question}</p>
      <p className="asked-text">{item.question}</p>
      {atoms.map((atom) => {
        // Book excerpts and sentences of other surahs come from what was held with the answer.
        const drawing = drawingFor(reading, atoms, item.heldContext);
        const shown = { ...reading, records: drawing.records, ayahs: drawing.ayahs };
        return atom.role === "source" ? <SourceAtomRow key={atom.id} atom={atom} ui={ui} onOpen={reading.onOpen} />
          : <ParagraphView key={atom.id} block={{ type: "paragraph", role: blockRole(atom), segments: displaySegments(atom) }} mode="flow" runPrefix={`asked:${item.id}:${atom.id}`} {...shown} />;
      })}
      <Button className="asked-remove" variant="quiet" size="sm" onClick={() => remove(item.id, entries.length === 1)}>{ui.ask.remove}</Button>
    </li>)}</ul>
    <p className="asked-note">{ask.accountSaved ? ui.history.saved_in_account : ui.ask.saved_on_device}</p>
  </section>;
}
