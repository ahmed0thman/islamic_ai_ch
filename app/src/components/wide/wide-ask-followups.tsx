"use client";

import { useWideSurface } from "./wide-surface";
import { useReading } from "@/components/reader/reading-context";
import { useAsk } from "@/components/reader/ask-state";

/** Suggestions are titles already carried by the verified explanation, never generated in the browser. */
export function WideAskFollowups({ onAsk }: { onAsk: (question: string) => boolean }) {
  const surface = useWideSurface();
  const ask = useAsk();
  const { ui } = useReading();
  if (!surface?.wide || !ask) return null;
  const questions = surface.suggestions.filter((question) => !ask.turns.some((turn) => turn.question === question)).slice(0, 3);
  if (!questions.length) return null;
  return <div className="wide-ask-followups"><p>{ui.ask.followups_title}</p>{questions.map((question) => <button type="button" key={question} disabled={ask.turns.some((turn) => turn.loading)} onClick={() => onAsk(question)}>{question}</button>)}</div>;
}
