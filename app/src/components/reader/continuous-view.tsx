import type { Block } from "@/lib/types";
import { dropStageAyah } from "@/lib/runs";
import type { ReadingProps } from "./reading-context";
import { ParagraphView } from "./paragraph-view";
import { DetailsItem } from "./details-item";
import { AyahFlow } from "./ayah-flow";

export type ContinuousViewProps = ReadingProps & { blocks: Block[]; showTitles?: boolean; openIndex?: number; /** Ayahs the scene already shows above: a paragraph that opens with one of them does not repeat it. */ stageKeys?: string[] };
export function ContinuousView({ blocks, showTitles = true, openIndex, stageKeys, ...reading }: ContinuousViewProps) {
  return <div className="continuous-view">{blocks.map((block, index) => {
    if (block.type === "heading") return <h2 className={`huda-reading-heading${block.kind === "question" ? " is-question" : ""}`} key={index}>{block.text}</h2>;
    if (block.type === "ayah") return <AyahFlow key={index} ayahs={block.keys.map((key) => reading.ayahs.get(key)!)} ui={reading.ui} />;
    if (block.type === "details") return <DetailsItem key={index} block={block} defaultOpen={index === openIndex} {...reading} />;
    return <div key={index}>{showTitles && block.title ? <h2 className="huda-reading-heading is-question">{block.title}</h2> : null}<ParagraphView block={stageKeys ? dropStageAyah(block, stageKeys) : block} runPrefix={`paragraph-${index}`} {...reading} /></div>;
  })}</div>;
}
