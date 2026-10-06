"use client";

import { useEffect, useRef } from "react";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { AskDock } from "./ask-dock";
import { ClosingSection, type ClosingSectionProps } from "./closing-section";
import { useWideSurface } from "@/components/wide/wide-surface";

export type ClosingSceneProps = Omit<ClosingSectionProps, "headingRef"> & { onBack: () => void };
/** The closing screen in the scene: a topbar with no pips (it is not a stop), then the section. `SceneShell` holds the dialog around it. */
export function ClosingScene({ onBack, ...section }: ClosingSceneProps) {
  const wide = useWideSurface()?.wide;
  const heading = useRef<HTMLHeadingElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); if (scroll.current) scroll.current.scrollTop = 0; if (wide) window.scrollTo({ top: 0, behavior: "instant" }); }, [wide]);
  const { ui } = section;
  return <>
    <header className="scene-topbar"><Button variant="quiet" onClick={onBack}><Icon icon={ArrowRight01Icon} />{ui.reader.back}</Button><div className="scene-pips" aria-hidden="true" />
      {section.previous && section.onPrevious ? <div className="scene-nav"><Button variant="round" size="icon" aria-label={ui.reader.previous_stop} onClick={section.onPrevious}><Icon icon={ArrowRight01Icon} /></Button></div> : null}</header>
    <div className="huda-scene-scroll" ref={scroll}><div className="huda-scene-body scene-body-enter"><div className="scene-reading"><ClosingSection headingRef={heading} beforeNext={<AskDock />} {...section} /></div></div></div>
  </>;
}
