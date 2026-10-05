"use client";

import { Fragment, useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Search01Icon } from "@hugeicons/core-free-icons";
import type { AskResponse, PublicAtom } from "@/lib/ask/types";
import { composedView, type ComposedItem } from "@/lib/ask-composed-view";
import { mergeQuestion } from "@/lib/voice-client";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BottomSheet } from "./bottom-sheet";
import { VoiceButton } from "./voice-button";
import { ParagraphView } from "./paragraph-view";
import { useReading } from "./reading-context";
import { useAsk } from "./ask-state";

const longEnough = (text: string) => [...text.trim()].length >= 3 && [...text.trim()].length <= 300;
/**
 * The question sheet: it knows where the reader stands (the stop open, or the whole surah) and sends that with the depth.
 * The answer is sentences of the explanation with their marks, as the reading shows them; nothing here writes Arabic.
 */
export function AskSheet({ surahNo, onClose }: { surahNo: number; onClose: () => void }) {
  const ask = useAsk()!;
  const { relations: _relations, ...reading } = useReading();
  const { ui } = reading;
  const id = useId();
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AskResponse | null>(null);
  const active = useRef<AbortController | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const voiceBase = useRef("");
  const [voiceActive, setVoiceActive] = useState(false);
  useEffect(() => () => active.current?.abort(), []);
  async function submit(event?: FormEvent) {
    event?.preventDefault();
    const text = question.trim();
    if (loading || !longEnough(text)) return;
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setLoading(true); setResult(null);
    try {
      const response = await fetch("/api/ask/", {
        method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surah: surahNo, question: text, depth: ask.depth, ...(ask.stop ? { stop: ask.stop.number } : {}) }),
      });
      const body = response.ok ? await response.json() as AskResponse : null;
      if (controller.signal.aborted) return;
      if (body && typeof body.status === "string" && Array.isArray(body.atoms)) {
        setResult(body);
        if (body.status === "answer" && body.atoms.length) ask.save({ question: text, atomIds: body.atoms.map((atom) => atom.id) });
      } else setResult({ status: "unavailable", atoms: [] });
    } catch {
      if (!controller.signal.aborted) setResult({ status: "unavailable", atoms: [] });
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }
  // Enter sends; Shift+Enter breaks the line. Never while an input method is composing, never while the mic owns the box.
  function onKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (voiceActive) return;
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void submit(); }
  }
  /** One verified sentence, drawn exactly as the reading draws it. */
  function atomRows(atoms: PublicAtom[]) {
    return <>{atoms.map((atom) => <div className="ask-atom" key={atom.id}>
      <ParagraphView block={{ type: "paragraph", role: atom.role, segments: atom.segments }} mode="flow" runPrefix={`ask:${atom.id}`} {...reading} />
      {atom.level !== ask.depth ? <span className="level-chip">{ui.ask.from_level} {levelName(atom.level)}</span> : null}
    </div>)}</>;
  }
  /** The written sentence first, then the verified sentences it rests on, one tap below it. */
  function composedItems(items: ComposedItem[]) {
    return <>{items.map((item, index) => item.kind === "verbatim" ? <Fragment key={index}>{atomRows(item.atoms)}</Fragment>
      : <div className="ask-composed" key={index}>
        <div className="ask-written"><ParagraphView block={{ type: "paragraph", role: "claim", segments: [{ t: "text", v: item.text }, { t: "mark", records: item.records }] }} mode="flow" runPrefix={`ask-composed:${index}`} {...reading} /></div>
        <details className="ask-verified">
          <summary><span className="ask-verified-open">{ui.ask.show_verified}</span><span className="ask-verified-close">{ui.ask.hide_verified}</span></summary>
          <div className="ask-verified-body">{atomRows(item.atoms)}</div>
        </details>
      </div>)}</>;
  }
  const composed = result ? composedView(result) : null;
  const levelName = (depth: number) => ui.levels.find((level) => level.depth === depth)?.name ?? "";
  const fixed = result?.status === "unavailable" ? ui.ask.unavailable
    : result?.status === "fatwa" ? ui.phrases.fatwa
    : result?.status === "out_of_scope" ? ui.phrases.out_of_scope
    : result?.status === "not_arabic" ? ui.phrases.arabic_only
    : ui.phrases.insufficient_sources;
  return <BottomSheet title={ask.stop ? ui.ask.title_stop : ui.ask.title} ui={ui} onClose={onClose}>
    <div className="ask-sheet">
      <p className="ask-context"><span>{ui.ask.about_stop}</span>: <b>{ask.stop?.title ?? ui.ask.whole_surah}</b></p>
      <form className="ask-form" onSubmit={submit} aria-busy={loading}>
        <label className="sr-only" htmlFor={`${id}-q`}>{ui.ask.placeholder}</label>
        <textarea ref={textarea} id={`${id}-q`} className="ask-input" name="question" rows={3} minLength={3} maxLength={300} required
          value={question} placeholder={ui.ask.placeholder} aria-describedby={`${id}-note`}
          readOnly={voiceActive} aria-busy={voiceActive || undefined}
          onChange={(event) => setQuestion(event.target.value)} onKeyDown={onKey} />
        <Button variant="primary" type="submit" disabled={loading || voiceActive || !longEnough(question)}><Icon icon={Search01Icon} />{ui.ask.submit}</Button>
        <VoiceButton surah={surahNo} depth={ask.depth} stop={ask.stop?.number ?? null} ui={ui} disabled={loading}
          onStart={() => { voiceBase.current = question.trim(); setVoiceActive(true); }}
          onLive={(text) => setQuestion(mergeQuestion(voiceBase.current, text))}
          onFinal={(text) => {
            if (text !== null) setQuestion(mergeQuestion(voiceBase.current, text));
            setVoiceActive(false);
            requestAnimationFrame(() => {
              const el = textarea.current;
              if (!el) return;
              el.focus();
              el.setSelectionRange(el.value.length, el.value.length);
            });
          }} />
      </form>
      <div className="ask-result" aria-live="polite" aria-atomic="false" aria-busy={loading}>
        {loading ? <p className="ask-loading">{ui.ask.loading}</p>
          : result?.status === "answer" ? <>
            <h3 className="ask-answer-title">{ui.ask.answer_title}</h3>
            {composed ? <>
              <p className="ask-composed-note">{ui.ask.composed_note}</p>
              {composedItems(composed)}
            </>
              : atomRows(result.atoms)}
          </>
          : result ? <>
            <p className="ask-fixed">{fixed}</p>
            {result.status === "fatwa" || result.status === "out_of_scope" ? <a className="ask-link" href={ui.links.fatwa.url}>{ui.links.fatwa.label}</a> : null}
          </> : null}
      </div>
      <p id={`${id}-note`} className="ask-note">{ui.ask.note}</p>
    </div>
  </BottomSheet>;
}
