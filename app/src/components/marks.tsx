import type { CSSProperties } from "react";
import type { BadgeKey, IconKey, SourceRecord, Ui } from "@/lib/types";

type InkStyle = CSSProperties & { "--ink": string };
export function Icon({ kind, ui }: { kind: IconKey; ui: Ui }) {
  const icon = ui.icons[kind];
  return <span className="source-icon" style={{ "--ink": icon.color } as InkStyle} aria-hidden="true">{icon.symbol}</span>;
}
export function Badge({ kind, ui }: { kind: BadgeKey; ui: Ui }) {
  const badge = ui.badges[kind];
  return <span className={`badge badge-${kind}`} style={{ "--ink": badge.color } as InkStyle}>{badge.label}</span>;
}
export function Marker({ records, ui, onOpen }: { records: SourceRecord[]; ui: Ui; onOpen: () => void }) {
  const kinds = ui.icon_order.filter((kind) => records.some((record) => record.icons.includes(kind)));
  const badges = [...new Set(records.map((record) => record.badge))].filter(
    (kind): kind is "la_yathbut" | "khilaf_mutabar" => kind === "la_yathbut" || kind === "khilaf_mutabar",
  );
  const label = [ui.panel.title, ...kinds.map((kind) => ui.icons[kind].label), ...badges.map((kind) => ui.badges[kind].label), ...records.map((record) => record.claim)].join(" — ");
  return <button type="button" className="marker" aria-label={label} aria-haspopup="dialog" onClick={(event) => { event.stopPropagation(); onOpen(); }}>
    <span className="marker-symbols">{kinds.map((kind) => <Icon key={kind} kind={kind} ui={ui} />)}</span>
    {badges.map((kind) => <Badge key={kind} kind={kind} ui={ui} />)}
  </button>;
}
