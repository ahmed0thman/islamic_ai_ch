"use client";

import { Fragment, useEffect, useId, useRef, useState, useLayoutEffect, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUp02Icon, Mic01Icon, StopIcon } from "@hugeicons/core-free-icons";
import type { AskResponse, PublicAtom } from "@/lib/ask/types";
import { composedView, type ComposedItem } from "@/lib/ask-composed-view";
import { mergeQuestion, clock } from "@/lib/voice-client";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BottomSheet } from "./bottom-sheet";
import { useVoice } from "./voice-button";
import { ParagraphView } from "./paragraph-view";
import { useReading } from "./reading-context";
import { useAsk, type AskTurn } from "./ask-state";
import { AskOrb } from "./ask-orb";

const longEnough = (text: string) => [...text.trim()].length >= 3 && [...text.trim()].length <= 300;

export function AskSheet({ surahNo, onClose }: { surahNo: number; onClose: () => void }) {
  const ask = useAsk()!;
  const { relations: _relations, ...reading } = useReading();
  const { ui } = reading;
  const id = useId();
  const [question, setQuestion] = useState("");
  const active = useRef<{ controller: AbortController, turnId: number } | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const voiceBase = useRef("");
  const orbRef = useRef<HTMLSpanElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const prevLen = useRef(ask.turns.length);

  const voice = useVoice({
    surah: surahNo, depth: ask.depth, stop: ask.stop?.number ?? null,
    onStart: () => { voiceBase.current = question.trim(); },
    onLive: (text) => setQuestion(mergeQuestion(voiceBase.current, text)),
    onFinal: (text) => {
      if (text !== null) setQuestion(mergeQuestion(voiceBase.current, text));
      requestAnimationFrame(() => {
        const el = textarea.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      });
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
    if (voice.state === "review") setVoiceMsg(ui.ask.voice_review);
    else if (voice.state === "partial") setVoiceMsg(ui.ask.voice_partial);
    else if (voice.state === "denied") setVoiceMsg(ui.ask.voice_denied);
    else if (voice.state === "failed") setVoiceMsg(ui.ask.voice_failed);
    else setVoiceMsg(null);
  }, [voice.state, ui.ask]);

  // Keyboard inset effect
  useEffect(() => {
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
  }, []);

  // Scroll last turn to top
  useEffect(() => {
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
  }, [ask.turns.length]);

  // Abort on unmount
  useEffect(() => () => {
    if (active.current) {
      active.current.controller.abort();
      ask.dropTurn(active.current.turnId);
    }
  }, [ask]);

  const loadingTurn = ask.turns.some((t) => t.loading);

  const performSubmit = (text: string) => {
    if (loadingTurn || !longEnough(text)) return;
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

    fetch("/api/ask/", {
      method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ surah: surahNo, question: text, depth: ask.depth, ...(ask.stop ? { stop: ask.stop.number } : {}) }),
    }).then(async response => {
      const body = response.ok ? await response.json() as AskResponse : null;
      if (controller.signal.aborted) return;
      active.current = null;
      if (body && typeof body.status === "string" && Array.isArray(body.atoms)) {
        ask.settleTurn(turnId, body);
        if (body.status === "answer" && body.atoms.length) ask.save({ question: text, atomIds: body.atoms.map((atom) => atom.id) });
      } else {
        ask.settleTurn(turnId, { status: "unavailable", atoms: [] });
      }
    }).catch(() => {
      if (!controller.signal.aborted) {
        active.current = null;
        ask.settleTurn(turnId, { status: "unavailable", atoms: [] });
      }
    });
  };

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

  function atomRows(atoms: PublicAtom[], turnId: number) {
    return <>{atoms.map((atom) => <div className="ask-atom" key={atom.id}>
      <ParagraphView block={{ type: "paragraph", role: atom.role, segments: atom.segments }} mode="flow" runPrefix={`ask:${turnId}:${atom.id}`} {...reading} />
      {atom.level !== ask.depth ? <span className="level-chip">{ui.ask.from_level} {levelName(atom.level)}</span> : null}
    </div>)}</>;
  }

  function composedItems(items: ComposedItem[], turnId: number) {
    return <>{items.map((item, index) => item.kind === "verbatim" ? <Fragment key={index}>{atomRows(item.atoms, turnId)}</Fragment>
      : <div className="ask-composed" key={index}>
        <div className="ask-written"><ParagraphView block={{ type: "paragraph", role: "claim", segments: [{ t: "text", v: item.text }, { t: "mark", records: item.records }] }} mode="flow" runPrefix={`ask-composed:${turnId}:${index}`} {...reading} /></div>
        <details className="ask-verified">
          <summary><span className="ask-verified-open">{ui.ask.show_verified}</span><span className="ask-verified-close">{ui.ask.hide_verified}</span></summary>
          <div className="ask-verified-body">{atomRows(item.atoms, turnId)}</div>
        </details>
      </div>)}</>;
  }

  function renderResult(turn: AskTurn) {
    const result = turn.result!;
    const composed = composedView(result);
    const fixed = result.status === "unavailable" ? ui.ask.unavailable
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
             {composedItems(composed, turn.id)}
           </> : atomRows(result.atoms, turn.id)}
        </>
      ) : (
        <>
          <p className="ask-fixed"><AskOrb size="sm" state="idle" /> {fixed}</p>
          {(result.status === "fatwa" || result.status === "out_of_scope") && <a className="ask-link" href={ui.links.fatwa.url}>{ui.links.fatwa.label}</a>}
        </>
      )}
    </>;
  }

  return <BottomSheet variant="ask" title={ask.stop ? ui.ask.title_stop : ui.ask.title} titleAfter={<span className="ask-ai-badge">{ui.ask.ai_badge}</span>} ui={ui} onClose={onClose}>
    <div className="ask-sheet">
      <div className="ask-body" ref={bodyRef}>
        {isListening ? (
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
             <p className="ask-note">{ui.ask.note}</p>
             {ask.starters.length > 0 && <div>
                <p className="ask-starters-label">{ui.ask.starters_title}</p>
                <div className="ask-starters">
                  {ask.starters.map((starter, i) => <button key={i} type="button" className="ask-starter" onClick={() => performSubmit(starter)}>{starter}</button>)}
                </div>
             </div>}
          </div>
        ) : (
          <div aria-live="polite">
            <ol className="ask-thread">
              {ask.turns.map(turn => (
                 <li className="ask-turn" key={turn.id}>
                   <p className="ask-question">{turn.question}</p>
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
  </BottomSheet>;
}
