"use client";

import { arrangeFollowups, type Followup } from "@/lib/followups";
import { DetailsItem } from "./details-item";
import { useReading } from "./reading-context";

/**
 * Deeper questions under a stop: each opens in its place, like a depth item. `candidates` come from `deriveFollowups`; `promoted` is a list of their ids
 * (the server fills it later from the reader's own questions): those show first, open, under their own title.
 */
export function FollowupsSection({ candidates, promoted = [] }: { candidates: Followup[]; promoted?: string[] }) {
  const reading = useReading();
  const { ui } = reading;
  const arranged = arrangeFollowups(candidates, promoted);
  if (!arranged.promoted.length && !arranged.rest.length) return null;
  const levelName = (depth: number) => ui.levels.find((level) => level.depth === depth)?.name ?? "";
  const rows = (items: Followup[], open: boolean) => items.map((item) => <DetailsItem key={item.id} block={{ type: "details", title: item.title, blocks: item.blocks }} defaultOpen={open}
    meta={<span className="level-chip">{levelName(item.depth)}</span>} {...reading} />);
  return <section className="followups" aria-label={ui.ask.followups_title}>
    {arranged.promoted.length ? <><h3 className="followups-title">{ui.ask.followups_from_you}</h3>{rows(arranged.promoted, true)}</> : null}
    {arranged.rest.length ? <><h3 className="followups-title">{ui.ask.followups_title}</h3>{rows(arranged.rest, false)}</> : null}
  </section>;
}
