"use client";

import type { MapStop } from "@/lib/map";
import { ContentBlock, type ReadingProps } from "./reader";

export function GlanceCard({ stop, ayahKeys, ...reading }: ReadingProps & { stop: MapStop; ayahKeys: string[] }) {
  return <section className="glance-card" aria-labelledby="glance-title">
    <div className="glance-highlight"><ContentBlock block={{ type: "ayah", keys: ayahKeys }} {...reading} /></div>
    <h2 className="glance-title" id="glance-title">{stop.title}</h2>
    <div className="glance-answer">{stop.scene.map((block, index) =>
      <ContentBlock key={index} block={block} showTitle={false} {...reading} />,
    )}</div>
  </section>;
}
