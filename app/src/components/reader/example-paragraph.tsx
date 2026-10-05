import { Idea01Icon } from "@hugeicons/core-free-icons";
import type { ParagraphBlock, Ui } from "@/lib/types";
import { Icon } from "@/components/ui/icon";

export type ExampleParagraphProps = { block: ParagraphBlock; ui: Ui };
/** An everyday example in the explainer's manner: it illustrates and claims nothing, so it has no marker, no sheet and no door. */
export function ExampleParagraph({ block, ui }: ExampleParagraphProps) {
  return <aside className="example-paragraph">
    <p className="example-label"><Icon icon={Idea01Icon} size={16} />{ui.example.label}</p>
    <p className="example-text">{block.segments.map((segment) => "v" in segment ? segment.v : "").join("")}</p>
  </aside>;
}
