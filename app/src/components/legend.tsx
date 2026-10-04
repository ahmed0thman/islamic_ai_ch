"use client";

import { useState } from "react";
import type { BadgeKey, Ui } from "@/lib/types";
import { Badge, Icon } from "./marks";

export function Legend({ ui }: { ui: Ui }) {
  const [expanded, setExpanded] = useState(false);
  return <aside className="legend-bar" aria-label={ui.legend.title}>
    <div className="legend-top">
      <button type="button" className="legend-toggle" aria-expanded={expanded} aria-controls="legend-content" onClick={() => setExpanded((value) => !value)}>
        <span>{expanded ? ui.legend.hide : ui.legend.show}</span><span aria-hidden="true">{expanded ? "−" : "+"}</span>
      </button>
      <div className="legend-mini" aria-hidden="true">{ui.icon_order.map((kind) => <Icon key={kind} kind={kind} ui={ui} />)}</div>
      <span className="legend-caption">{ui.legend.title}</span>
    </div>
    <div id="legend-content" className="legend-content" hidden={!expanded}>
      <h2>{ui.legend.title}</h2>
      <div className="legend-columns">
        <section><h3>{ui.legend.icons_title}</h3><dl>
          {ui.icon_order.map((kind) => <div className="legend-entry" key={kind}>
            <dt><Icon kind={kind} ui={ui} /><span>{ui.icons[kind].label}</span></dt><dd>{ui.icons[kind].meaning}</dd>
          </div>)}
        </dl></section>
        <section><h3>{ui.legend.badges_title}</h3><dl>
          {(Object.keys(ui.badges) as BadgeKey[]).map((kind) => <div className="legend-entry" key={kind}>
            <dt><Badge kind={kind} ui={ui} /></dt><dd>{ui.badges[kind].meaning}</dd>
          </div>)}
        </dl><p className="legend-note">{ui.link_strength.note}</p></section>
      </div>
    </div>
  </aside>;
}
