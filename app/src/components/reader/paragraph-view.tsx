import type { ParagraphBlock } from "@/lib/types";
import { blockRelationIds } from "@/lib/relations";
import type { ClaimTextProps } from "./claim-text";
import { ClaimText } from "./claim-text";
import { RelationCard } from "./relation-card";

export type ParagraphViewProps = ClaimTextProps & { block: ParagraphBlock };
export function ParagraphView({ relations = [], ...props }: ParagraphViewProps) {
  const ids = new Set(blockRelationIds(props.block));
  return <><ClaimText {...props} />{relations.filter((record) => ids.has(record.id)).map((record) => {
    const ayahs = [...new Set(record.ayah_keys)].map((key) => props.ayahs.get(key)).filter((ayah) => ayah && ayah.key.startsWith(`${props.surahNo}:`));
    return ayahs.length === 2 ? <RelationCard key={record.id} record={record} ayahs={[ayahs[0]!, ayahs[1]!]} ui={props.ui} onOpen={props.onOpen} /> : null;
  })}</>;
}
