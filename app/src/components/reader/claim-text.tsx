import type { CSSProperties, ReactNode } from "react";
import type { ParagraphBlock, Segment } from "@/lib/types";
import { toRuns, shouldStack } from "@/lib/runs";
import { splitLastWord } from "@/lib/reading-text";
import type { ReadingProps } from "./reading-context";
import { InlineAyah } from "./inline-ayah";
import { VerbatimQuote } from "./verbatim-quote";
import { TermLink } from "./term-link";
import { SourceMarker } from "./source-marker";

export type ClaimTextProps = ReadingProps & { block: ParagraphBlock; mode?: "auto" | "flow" | "pulses"; activeRun?: string | null; inline?: boolean; runPrefix?: string };
/** Punctuation belongs to the preceding claim, without changing its attribution boundary. */
function displayRuns(input: Segment[][]): Segment[][] {
  const runs: Segment[][] = [];
  for (const run of input) {
    // Keep adjacent citations with the same printed ending; toRuns remains unchanged.
    if (run.every((segment) => segment.t === "mark") && runs.length) runs.at(-1)!.push(...run);
    else runs.push([...run]);
  }
  for (let index = 1; index < runs.length; index++) {
    const first = runs[index][0];
    if (first?.t !== "text") continue;
    const punctuation = first.v.match(/^\s*\p{P}+/u)?.[0];
    if (!punctuation) continue;
    const previous = runs[index - 1];
    if (previous.at(-1)?.t !== "mark") continue;
    let ending = previous.length - 1;
    while (ending > 0 && previous[ending - 1].t === "mark") ending--;
    const before = previous[ending - 1];
    if (before?.t === "text") previous[ending - 1] = { ...before, v: before.v + punctuation.trimStart() };
    else if (before?.t !== "quote" && before?.t !== "ayah") previous.splice(ending, 0, { t: "text", v: punctuation.trimStart() });
    runs[index][0] = { ...first, v: first.v.slice(punctuation.length) };
  }
  return runs;
}
function RunSegments({ segments, ...reading }: ReadingProps & { segments: Segment[] }) {
  const { ayahs, records, ui, onOpen } = reading;
  const nodes: ReactNode[] = [];
  const marker = (segment: Extract<Segment, { t: "mark" }>, key: string) => {
    const sources = [...new Set(segment.records)].map((id) => records[id]);
    return <SourceMarker key={key} records={sources} ui={ui} onOpen={() => onOpen(sources)} />;
  };
  function followingMarkers(index: number) {
    const markers: ReactNode[] = [];
    while (segments[index + 1]?.t === "mark") {
      index++;
      markers.push(marker(segments[index] as Extract<Segment, { t: "mark" }>, `marker-${index}`));
    }
    return { markers: markers.length ? <>{markers}</> : undefined, lastIndex: index };
  }
  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index], next = segments[index + 1];
    if (segment.t === "quote" || segment.t === "ayah") {
      const following = followingMarkers(index);
      if (segment.t === "quote") nodes.push(<VerbatimQuote key={index} text={segment.v} record={segment.record} marker={following.markers} />);
      else nodes.push(<InlineAyah key={index} ayah={ayahs.get(segment.key)!} ui={ui} marker={following.markers} />);
      index = following.lastIndex;
    } else if (segment.t === "term") {
      const term = <TermLink term={segment.v} record={records[segment.record]} ui={ui} onOpen={onOpen} />;
      if (next?.t === "mark") { const following = followingMarkers(index); nodes.push(<span key={index} className="claim-ending">{term}{following.markers}</span>); index = following.lastIndex; }
      else if (next?.t === "text" && /^\s*\p{P}+\s*$/u.test(next.v) && segments[index + 2]?.t === "mark") {
        const following = followingMarkers(index + 1);
        nodes.push(<span key={index} className="claim-ending">{term}{next.v}{following.markers}</span>); index = following.lastIndex;
      } else nodes.push(<span key={index}>{term}</span>);
    } else if (segment.t === "text") {
      if (next?.t === "mark") {
        const [start, end] = splitLastWord(segment.v);
        const following = followingMarkers(index);
        nodes.push(<span key={index}>{start}<span className="claim-ending">{end}{following.markers}</span></span>); index = following.lastIndex;
      } else nodes.push(<span key={index}>{segment.v}</span>);
    } else {
      // Consecutive marks remain attached to the preceding end rather than orphaned.
      const preceding = nodes.pop();
      nodes.push(<span className="claim-ending" key={index}>{preceding}{marker(segment, `marker-${index}`)}</span>);
    }
  }
  return <>{nodes}</>;
}
export function ClaimText({ block, mode = "auto", activeRun, inline = false, runPrefix, ...reading }: ClaimTextProps) {
  const rawRuns = toRuns(block.segments);
  const stack = !inline && mode !== "flow" && shouldStack(block, rawRuns);
  const runs = displayRuns(rawRuns);
  const children = runs.map((segments, index) => {
    const mark = segments.find((segment) => segment.t === "mark");
    const first = mark?.t === "mark" ? reading.records[mark.records[0]] : undefined;
    const id = `${runPrefix ?? "claim"}:${index}:${mark?.t === "mark" ? mark.records.join("-") : "tail"}`;
    const tone = first?.icons[0] ? reading.ui.icons[first.icons[0]].color : "var(--line-strong)";
    return <span key={id} data-run={id} data-active-source={activeRun === id ? "true" : undefined} className={stack ? "claim-pulse" : undefined} style={stack ? { "--tone": tone } as CSSProperties : undefined}><RunSegments segments={segments} {...reading} /></span>;
  });
  return inline ? <span className="claim-summary">{children}</span> : <p className={`claim-text${stack ? " claim-text-pulses" : ""}${block.role === "transmission" ? " claim-transmission" : ""}`}>{children}</p>;
}
