import type { Ayah, SourceRecord, Ui } from "@/lib/types";
import { splitLastWord } from "@/lib/reading-text";
import { InlineAyah } from "./inline-ayah";
import { AyahReference } from "./ayah-reference";
import { SourceMarker } from "./source-marker";

export type RelationCardProps = { record: SourceRecord; ayahs: [Ayah, Ayah]; ui: Ui; onOpen: (records: SourceRecord[]) => void };
export function RelationCard({ record, ayahs, ui, onOpen }: RelationCardProps) {
  const [start, end] = splitLastWord(record.claim);
  return <section className="relation-card" data-relation={record.id}>
    <div className="relation-pair">{[...ayahs].sort((a, b) => a.no - b.no).map((ayah) => <InlineAyah key={ayah.key} ayah={ayah} ui={ui} reference={<AyahReference ayah={ayah} ui={ui} />} />)}</div>
    <p className="claim-text" data-run={`relation:${record.id}`}>{start}<span className="claim-ending">{end}<SourceMarker records={[record]} ui={ui} onOpen={() => onOpen([record])} /></span></p>
  </section>;
}
