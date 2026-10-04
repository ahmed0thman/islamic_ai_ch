"use client";

import type { MapStop } from "@/lib/map";
import { ContinuousView } from "./reader/continuous-view";
import type { ReadingProps } from "./reader/reading-context";

export function GlanceCard({ stop, ayahKeys, ...reading }: ReadingProps & { stop: MapStop; ayahKeys: string[] }) {
  return <section className="glance-card" aria-labelledby="glance-title">
    <div className="glance-highlight"><ContinuousView blocks={[{ type: "ayah", keys: ayahKeys }]} {...reading} /></div>
    <h2 className="glance-title" id="glance-title">{stop.title}</h2>
    <div className="glance-answer"><ContinuousView blocks={stop.scene} showTitles={false} {...reading} /></div>
  </section>;
}
