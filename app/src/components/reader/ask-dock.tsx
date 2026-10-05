"use client";

import { BubbleChatQuestionIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useReading } from "./reading-context";
import { useAsk } from "./ask-state";

/**
 * The «اسأل» button. It sits in the flow where the reading ends and is sticky to the bottom edge of its scroller, so it stays in reach
 * while one reads and comes to rest above the next-card instead of covering it. A dock is at the end of the map and the continuous text,
 * and inside every scene (a scene is a dialog: a button outside it would be inert). Nothing renders when «اسأل» is off.
 */
export function AskDock() {
  const ask = useAsk();
  const { ui } = useReading();
  if (!ask) return null;
  return <div className="ask-dock"><Button className="ask-fab" variant="primary" size="icon" aria-label={ui.ask.open} aria-haspopup="dialog"
    onClick={(event) => { event.currentTarget.focus({ preventScroll: true }); ask.open(); }}><Icon icon={BubbleChatQuestionIcon} size={24} /></Button></div>;
}
