"use client";

import { PlusSignIcon, MinusSignIcon } from "@hugeicons/core-free-icons";
import type { Block } from "@/lib/types";
import { Icon } from "@/components/ui/icon";
import type { ReadingProps } from "./reading-context";
import { ClaimText } from "./claim-text";
import { ParagraphView } from "./paragraph-view";

export type DetailsItemProps = ReadingProps & { block: Extract<Block, { type: "details" }>; defaultOpen?: boolean; /** Shown with the title on the closed row, e.g. the depth a deeper question comes from. */ meta?: React.ReactNode; children?: React.ReactNode };
export function DetailsItem({ block, defaultOpen = false, meta, children, ...reading }: DetailsItemProps) {
  return <details className="details-item" open={defaultOpen || undefined}>
    <summary>{meta ? <span className="details-summary-text"><ClaimText block={{ type: "paragraph", role: "claim", segments: block.title }} mode="flow" inline {...reading} />{meta}</span> : <ClaimText block={{ type: "paragraph", role: "claim", segments: block.title }} mode="flow" inline {...reading} />}<span className="details-indicator"><span className="detail-plus"><Icon icon={PlusSignIcon} /></span><span className="detail-minus"><Icon icon={MinusSignIcon} /></span></span></summary>
    <div className="details-item-body">{block.blocks.map((inner, index) => <ParagraphView key={index} block={inner} mode="flow" {...reading} />)}{children}</div>
  </details>;
}
