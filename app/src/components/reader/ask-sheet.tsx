"use client";

import { Fragment, useEffect, useId, useRef, useState, useLayoutEffect, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUp02Icon, Mic01Icon, StopIcon } from "@hugeicons/core-free-icons";
import type { AskResponse, PublicAtom } from "@/lib/ask/types";
import { composedView, type ComposedItem } from "@/lib/ask-composed-view";
import { historyFromTurns } from "@/lib/ask/history";
import { blockRole, displaySegments, drawingFor, requestAsk } from "@/lib/ask-client";
import { FAULT_UI_KEY } from "@/lib/ask/fault";
import { getOwnKey, OWN_KEY_CHANGE_EVENT, type AskKeyProvider } from "@/lib/own-key";
import { mergeQuestion, clock } from "@/lib/voice-client";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BottomSheet } from "./bottom-sheet";
import { useVoice } from "./voice-button";
import { ParagraphView } from "./paragraph-view";
import { SourceAtomRow } from "./source-atom-row";
import { useSheets } from "./sheet-provider";
import { ExampleParagraph } from "./example-paragraph";
import { useReading } from "./reading-context";
import { useAsk, type AskTurn } from "./ask-state";
import { AskOrb } from "./ask-orb";
import { SettingsKeyHint } from "@/components/settings/settings";
import keyStyles from "./key-sheet.module.css";
import { WideAskFollowups } from "@/components/wide/wide-ask-followups";
import { useWideSurface } from "@/components/wide/wide-surface";

const longEnough = (text: string) => [...text.trim()].length >= 3 && [...text.trim()].length <= 300;

export function AskSheet({ surahNo, onClose }: { surahNo: number; onClose: () => void }) {
  const wideSurface = useWideSurface();
  const wide = wideSurface?.wide;
  const ask = useAsk()!;
  const { openRecord } = useSheets();
  const { relations: _relations, ...reading } = useReading();
  const { ui } = reading;
  const id = useId();
  const [question, setQuestion] = useState("");
  const [ownProvider, setOwnProvider] = useState<AskKeyProvider | null>(null);
  useEffect(() => {
    const update = () => setOwnProvider(getOwnKey()?.provider ?? null);
    update();
    window.addEventListener(OWN_KEY_CHANGE_EVENT, update);
    return () => window.removeEventListener(OWN_KEY_CHANGE_EVENT, update);
  }, []);
  const active = useRef<{ controller: AbortController, turnId: number } | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const voiceBase = useRef("");
  const orbRef = useRef<HTMLSpanElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const prevLen = useRef(ask.turns.length);

  const submitRef = useRef<(text: string) => boolean>(() => false);
  const voice = useVoice({
    surah: surahNo, depth: ask.depth, stop: ask.stop?.number ?? null,
    onStart: () => { voiceBase.current = question.trim(); },
    onLive: (text) => setQuestion(mergeQuestion(voiceBase.current, text)),
    onFinal: (text) => {
      if (text === null) return; // nothing final: what was heard so far stays in the field for the reader to fix
      // A spoken question goes out as soon as its final text is here, as in a voice chat; the field is left empty.
      const spoken = mergeQuestion(voiceBase.current, text);
      if (!submitRef.current(spoken)) setQuestion(spoken);
    },
    onLevel: (level) => {
      const el = orbRef.current;
      if (!el) return;
      el.style.setProperty("--level", String(level ?? 0));
      if (level === null) el.setAttribute("data-level", "off");
      else el.removeAttribute("data-level");
    }
  });

  const isListening = voice.state === "listening" || voice.state === "finalizing";
  const [voiceMsg, setVoiceMsg] = useState<string | null>(null);
  useEffect(() => {
    // "review" carries no message any more: a final transcript is sent at once.
    if (voice.state === "partial") setVoiceMsg(ui.ask.voice_partial);
    else if (voice.state === "denied") setVoiceMsg(ui.ask.voice_denied);
    else if (voice.state === "failed") setVoiceMsg(ui.ask.voice_failed);
    else setVoiceMsg(null);
  }, [voice.state, ui.ask]);

  // Keyboard inset effect
  useEffect(() => {
    if (wide) return;
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv) return;
    const update = () => {
      document.documentElement.style.setProperty("--kb", Math.max(0, window.innerHeight - vv.height - vv.offsetTop) + "px");
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      document.documentElement.style.removeProperty("--kb");
    };
  }, [wide]);

  // Scroll last turn to top
  useEffect(() => {
    if (wide) return;
    const turnsLen = ask.turns.length;
    if (turnsLen === 0) return;
    const isNew = turnsLen > prevLen.current;
    prevLen.current = turnsLen;
    const list = bodyRef.current;
    if (!list) return;
    const lastTurn = list.querySelector(".ask-turn:last-child .ask-question");
    if (lastTurn) {
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      lastTurn.scrollIntoView({ block: "start", behavior: isNew && !prefersReducedMotion ? "smooth" : "auto" });
    }
  }, [ask.turns.length, wide]);
  useEffect(() => {
    if (!wide || wideSurface?.tab !== "ask" || !wideSurface.panelOpen || !bodyRef.current) return;
    const list = bodyRef.current;
    const question = list.querySelector<HTMLElement>(".ask-turn:last-child .ask-question");
    if (question) list.scrollTo({ top: Math.max(0, question.getBoundingClientRect().top - list.getBoundingClientRect().top + list.scrollTop - 8), behavior: "auto" });
  }, [wide, wideSurface?.tab, wideSurface?.panelOpen, ask.turns]);

  // Abort on unmount only: the ask state changes with every turn, so the cleanup must not depend on it.
  const dropTurn = useRef(ask.dropTurn);
  dropTurn.current = ask.dropTurn;
  useEffect(() => () => {
    if (active.current) {
      active.current.controller.abort();
      dropTurn.current(active.current.turnId);
    }
  }, []);

  const loadingTurn = ask.turns.some((t) => t.loading);
  // The note under the composer says books are woven in when the page knew it or a reply showed it.
  const booksOn = ask.sources || ask.turns.some((turn) => turn.result?.sources || turn.result?.atoms.some((atom) => atom.role === "source"));

  const performSubmit = (text: string): boolean => {
    if (loadingTurn || !longEnough(text)) return false;
    const turnId = ask.addTurn(text);
    setQuestion("");
    voiceBase.current = "";
    setVoiceMsg(null);
    if (window.matchMedia("(pointer: coarse)").matches) {
      textarea.current?.blur();
    }
    
    active.current?.controller.abort();
    const controller = new AbortController();
    active.current = { controller, turnId };

    // The last two finished turns, so the server can tell what "this" or "clearer" refers to.
    const history = historyFromTurns(ask.turns);
    const send = () => requestAsk({ surah: surahNo, question: text, depth: ask.depth, ...(ask.stop ? { stop: ask.stop.number } : {}), ...(history.length ? { history } : {}), ...(openRecord && /^\d{1,3}-r\d{2,4}$/.test(openRecord) ? { open_record: openRecord } : {}) }, controller.signal);
    // A request lost on the way (a dropped connection, a gateway error) is sent once more before the reader is told.
    send().then((response) => response.status >= 500 ? send() : response, () => send()).then(async response => {
      const body = response.ok ? await response.json() as AskResponse : null;
      if (controller.signal.aborted) return;
      active.current = null;
      if (body && typeof body.status === "string" && Array.isArray(body.atoms)) {
        ask.settleTurn(turnId, body);
        if (body.status === "answer" && body.atoms.length) {
          // What this surah's content cannot give back by id (a book excerpt, a sentence of another surah) is kept with the answer, as it was shown.
          const held = body.atoms.filter((atom) => atom.role === "source" || (atom.surah !== undefined && atom.surah !== surahNo));
          ask.save({ question: text, atomIds: body.atoms.map((atom) => atom.id), ...(held.length ? { held, ...(body.extra ? { heldContext: body.extra } : {}) } : {}) });
        }
      } else {
        ask.settleTurn(turnId, { status: "unavailable", atoms: [] });
      }
    }).catch(() => {
      if (!controller.signal.aborted) {
        active.current = null;
        ask.settleTurn(turnId, { status: "unavailable", atoms: [] });
      }
    });
    return true;
  };
  submitRef.current = performSubmit;

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    performSubmit(question.trim());
  };

  function onKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (isListening) return;
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      performSubmit(question.trim());
    }
  }

  // Fallback for field-sizing
  useLayoutEffect(() => {
    const el = textarea.current;
    if (!el || CSS.supports("field-sizing", "content")) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 152) + "px";
  }, [question]);

  const levelName = (depth: number) => ui.levels.find((level) => level.depth === depth)?.name ?? "";

  const surahName = (no: number) => ask.surahs.find((item) => item.no === no)?.name ?? "";
  type Drawing = ReturnType<typeof drawingFor>;

  function atomRows(atoms: PublicAtom[], turnId: number, drawing: Drawing) {
    const shown = { ...reading, records: drawing.records, ayahs: drawing.ayahs };
    return <>{atoms.map((atom) => atom.role === "source"
      ? <div className="ask-atom" key={atom.id}><SourceAtomRow atom={atom} ui={ui} onOpen={reading.onOpen} /></div>
      : <div className="ask-atom" key={atom.id}>
        {/* A narration with no record, or whose record is not marked established, says so above its words (decision 093). */}
        {atom.role === "transmission" && (!atom.records.length || atom.records.some((id) => drawing.records[id]?.badge !== "thabit")) ? <p className="ask-report-note">{ui.ask.report_note}</p> : null}
        <ParagraphView block={{ type: "paragraph", role: blockRole(atom), segments: displaySegments(atom) }} mode="flow" runPrefix={`ask:${turnId}:${atom.id}`} {...shown} />
        {atom.level !== ask.depth ? <span className="level-chip">{ui.ask.from_level} {levelName(atom.level)}</span> : null}
        {atom.surah !== undefined && atom.surah !== surahNo && surahName(atom.surah) ? <p className="ask-from-surah">{ui.ask.from_surah.replace("{name}", surahName(atom.surah))}</p> : null}
      </div>)}</>;
  }

  function composedItems(items: ComposedItem[], turnId: number, drawing: Drawing) {
    const shown = { ...reading, records: drawing.records, ayahs: drawing.ayahs };
    return <>{items.map((item, index) => item.kind === "verbatim" ? <Fragment key={index}>{atomRows(item.atoms, turnId, drawing)}</Fragment>
      : item.kind === "example" ? <div className="ask-example" key={index}>
        <ExampleParagraph block={{ type: "paragraph", role: "example", segments: [{ t: "text", v: item.text }] }} ui={ui} />
        <p className="ask-example-note">{ui.ask.example_note}</p>
      </div>
      : <div className="ask-composed" key={index}>
        <div className="ask-written"><ParagraphView block={{ type: "paragraph", role: "claim", segments: [{ t: "text", v: item.text }, { t: "mark", records: item.records }] }} mode="flow" runPrefix={`ask-composed:${turnId}:${index}`} {...shown} /></div>
        <details className="ask-verified">
          <summary><span className="ask-verified-open">{ui.ask.show_verified}</span><span className="ask-verified-close">{ui.ask.hide_verified}</span></summary>
          <div className="ask-verified-body">{atomRows(item.atoms, turnId, drawing)}</div>
        </details>
      </div>)}</>;
  }

  function renderResult(turn: AskTurn) {
    const result = turn.result!;
    const composed = composedView(result);
    const drawing = drawingFor(reading, result.atoms, result.extra);
    // A failure of a judge's own key is told by its fixed reason; anything else unavailable keeps the one general message and the hint to add a key.
    const fixed = result.status === "unavailable" ? (result.reason ? ui.ask[FAULT_UI_KEY[result.reason]] : ui.ask.unavailable)
      : result.status === "fatwa" ? ui.phrases.fatwa
      : result.status === "out_of_scope" ? ui.phrases.out_of_scope
      : result.status === "not_arabic" ? ui.phrases.arabic_only
      : ui.phrases.insufficient_sources;

    return <>
      {result.status === "answer" ? (
        <>
          <h3 className="ask-answer-title"><AskOrb size="sm" state="idle" /> {ui.ask.answer_title}</h3>
          {composed ? <>
             <p className="ask-composed-note">{ui.ask.composed_note}</p>
             {composedItems(composed, turn.id, drawing)}
           </> : atomRows(result.atoms, turn.id, drawing)}
          <WideAskFollowups onAsk={performSubmit} />
        </>
      ) : (
        <>
          <p className="ask-fixed"><AskOrb size="sm" state="idle" /> {fixed}</p>
          {result.status === "unavailable" && !result.reason ? <SettingsKeyHint ui={ui} /> : null}
          {(result.status === "fatwa" || result.status === "out_of_scope") && <a className="ask-link" href={ui.links.fatwa.url}>{ui.links.fatwa.label}</a>}
        </>
      )}
    </>;
  }

  return <><BottomSheet variant="ask" title={ask.stop ? ui.ask.title_stop : ui.ask.title} titleAfter={<>
    <span className="ask-ai-badge">{ui.ask.ai_badge}</span>
  </>} ui={ui} onClose={onClose}>
    <div className="ask-sheet">
      <div className="ask-body" ref={bodyRef}>
        {ownProvider ? <p className={keyStyles.using} role="status">{ui.judge_key.using.replace("{provider}", ui.judge_key.providers[ownProvider])}</p>
          : ask.turns.some((turn) => turn.result?.status === "unavailable") ? <p className={keyStyles.using}>{ui.judge_key.intro}</p> : null}
        {isListening && (!wide || !ask.turns.length) ? (
          <div className="ask-stage" role="status" aria-live="polite">
            <AskOrb ref={orbRef} size="lg" state={voice.state === "finalizing" ? "thinking" : "listening"} />
            <p className="ask-stage-title">
              {voice.state === "finalizing" ? ui.ask.voice_transcribing : <>{ui.ask.voice_listening_title}<span className="ask-voice-clock">{clock(voice.elapsed)}</span></>}
            </p>
            {voice.state === "listening" && <p className="ask-stage-hint">{ui.ask.voice_listening_hint}</p>}
            {voice.state === "listening" && <p className="ask-stage-note">{ui.ask.voice_privacy}</p>}
          </div>
        ) : ask.turns.length === 0 ? (
          <div className="ask-empty">
             <AskOrb size="lg" state="idle" />
             <p className="ask-context">{ui.ask.about_stop}: <b>{ask.stop?.title ?? ui.ask.whole_surah}</b></p>
             <p className="ask-note">{booksOn ? ui.ask.note_sources : ui.ask.note}</p>
             {ask.starters.length > 0 && <div>
                <p className="ask-starters-label">{ui.ask.starters_title}</p>
                <div className="ask-starters">
                  {ask.starters.map((starter, i) => <button key={i} type="button" className="ask-starter" onClick={() => performSubmit(starter)}>{starter}</button>)}
                </div>
             </div>}
          </div>
        ) : (
          <div aria-live="polite">
            {wide && isListening ? <p className="wide-voice-status" role="status"><AskOrb ref={orbRef} size="sm" state={voice.state === "finalizing" ? "thinking" : "listening"} />
              {voice.state === "finalizing" ? ui.ask.voice_transcribing : <>{ui.ask.voice_listening_title}<span className="ask-voice-clock">{clock(voice.elapsed)}</span></>}
            </p> : null}
            <ol className="ask-thread">
              {ask.turns.map(turn => (
                 <li className="ask-turn" key={turn.id}>
                   <p className="ask-question">{wide ? <span className="sheet-label wide-question-label">{ui.ask.your_question}</span> : null}{turn.question}</p>
                   {turn.loading ? <div className="ask-loading"><AskOrb size="sm" state="thinking" /> {ui.ask.loading}</div>
                   : turn.result ? renderResult(turn) : null}
                 </li>
              ))}
            </ol>
          </div>
        )}
      </div>
      
      {voiceMsg && !isListening && <p className="ask-voice-msg" role="status">{voiceMsg}</p>}

      <form className="ask-composer" onSubmit={submit}>
        <label className="sr-only" htmlFor={`${id}-q`}>{ui.ask.placeholder}</label>
        <textarea ref={textarea} id={`${id}-q`} className="ask-input" name="question" rows={1}
          value={question} placeholder={ui.ask.placeholder}
          readOnly={isListening} aria-busy={isListening || undefined}
          onChange={(event) => setQuestion(event.target.value)} onKeyDown={onKey} />
        
        <div className="ask-actions">
          {voice.supported && (
            <span className="ask-voice">
              <Button type="button" onClick={voice.toggle}
                disabled={loadingTurn || (voice.state === "finalizing")}
                aria-label={isListening ? ui.ask.voice_stop : ui.ask.voice_start}
                aria-pressed={isListening}
                data-state={isListening ? "listening" : undefined}>
                <Icon icon={isListening ? StopIcon : Mic01Icon} />
              </Button>
            </span>
          )}
          <Button type="submit" disabled={loadingTurn || isListening || !longEnough(question)} aria-label={ui.ask.submit}>
            <Icon icon={ArrowUp02Icon} />
          </Button>
        </div>
      </form>
    </div>
  </BottomSheet>
  </>;
}
