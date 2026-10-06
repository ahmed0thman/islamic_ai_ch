import type { Depth } from "./types";

export type WideCommand = { kind: "step"; direction: 1 | -1 } | { kind: "depth"; depth: Depth }
  | { kind: "ask" | "view" | "escape" | "shortcuts" };
export function wideCommand(event: { key: string; altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean; isComposing?: boolean; defaultPrevented?: boolean }, editing: boolean): WideCommand | null {
  if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return null;
  if (event.key === "Escape") return { kind: "escape" };
  if (editing) return null;
  if (event.key === "ArrowLeft" || event.key.toLowerCase() === "j") return { kind: "step", direction: 1 };
  if (event.key === "ArrowRight" || event.key.toLowerCase() === "k") return { kind: "step", direction: -1 };
  if (/^[1-4]$/.test(event.key)) return { kind: "depth", depth: Number(event.key) - 1 as Depth };
  if (event.key === "/") return { kind: "ask" };
  if (event.key.toLowerCase() === "m") return { kind: "view" };
  if (event.key === "?") return { kind: "shortcuts" };
  return null;
}

export function wideEscapeAction(state: { editing: boolean; popover: boolean; drawer: boolean; detail: boolean; passage: boolean; scene: boolean }) {
  if (state.popover) return "popover";
  if (state.editing) return "blur";
  if (state.drawer) return "drawer";
  if (state.detail) return "detail";
  if (!state.passage) return "passage";
  return state.scene ? "map" : null;
}
