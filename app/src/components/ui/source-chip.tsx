import type { CSSProperties } from "react";
import { FootprintsIcon, CompassIcon, Link01Icon, Quran03Icon, QuillWrite01Icon, QuoteDownIcon } from "@hugeicons/core-free-icons";
import type { IconKey, Ui } from "@/lib/types";
import { Icon } from "./icon";

/* One professional glyph per source type (ق-074; names verified in design/DESIGN.md section 2.1). */
export const SOURCE_ICONS = { ayah: Quran03Icon, hadith: QuoteDownIcon, athar: FootprintsIcon, scholar: QuillWrite01Icon, link: Link01Icon, hidaya: CompassIcon } as const satisfies Record<IconKey, unknown>;

export type SourceGlyphProps = { kind: IconKey; size?: 16 | 20 | 24; className?: string };
export function SourceGlyph({ kind, size = 16, className }: SourceGlyphProps) {
  return <Icon icon={SOURCE_ICONS[kind]} size={size} className={className} />;
}

export type SourceChipProps = { kind: IconKey; ui: Ui; size?: "small" | "default" | "legend" };
export function SourceChip({ kind, ui, size = "default" }: SourceChipProps) {
  const entry = ui.icons[kind];
  return <span className={`source-chip source-tone source-chip-${size}`} data-kind={kind} style={{ "--tone": entry.color } as CSSProperties} aria-hidden="true"><SourceGlyph kind={kind} /></span>;
}

/* Type badge for the source sheet: glyph and label side by side. The label stays text for screen readers. */
export function SourceTypeBadge({ kind, ui }: { kind: IconKey; ui: Ui }) {
  const entry = ui.icons[kind];
  return <span className="source-type-badge source-tone" style={{ "--tone": entry.color } as CSSProperties}><SourceGlyph kind={kind} size={16} />{entry.label}</span>;
}
