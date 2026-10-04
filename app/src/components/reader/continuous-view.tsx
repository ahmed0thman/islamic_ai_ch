import type { Block } from "@/lib/types";
import type { ReadingProps } from "./reading-context";
import { ParagraphView } from "./paragraph-view";
import { DetailsItem } from "./details-item";
import { InlineAyah } from "./inline-ayah";

export type ContinuousViewProps = ReadingProps & { blocks: Block[]; showTitles?: boolean };
export function ContinuousView({ blocks, showTitles = true, ...reading }: ContinuousViewProps) {
  return <div className="continuous-view">{blocks.map((block, index) => {
    if (block.type === "heading") return <h2 className={`huda-reading-heading${block.kind === "question" ? " is-question" : ""}`} key={index}>{block.text}</h2>;
    if (block.type === "ayah") return <section className="reading-ayahs" aria-label={reading.ui.reader.ayahs_title} key={index}>{block.keys.map((key) => <InlineAyah key={key} ayah={reading.ayahs.get(key)!} ui={reading.ui} />)}</section>;
    if (block.type === "details") return <DetailsItem key={index} block={block} {...reading} />;
    return <div key={index}>{showTitles && block.title ? <h2 className="huda-reading-heading is-question">{block.title}</h2> : null}<ParagraphView block={block} runPrefix={`paragraph-${index}`} {...reading} /></div>;
  })}</div>;
}
