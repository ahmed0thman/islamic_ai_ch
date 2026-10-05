import { createContext, useContext } from "react";
import type { Depth } from "@/lib/types";
import type { AskedQuestion } from "@/lib/asked";
import type { Atom } from "@/lib/ask/types";

/** The stop the reader has open, as «اسأل» needs it: its number at the current depth (the `?stop=N` of the URL) and the title the scene shows. */
export interface AskStop { number: number; title: string }
export type AskedEntry = { item: AskedQuestion; atoms: Atom[] };
export interface AskState {
  depth: Depth;
  stop: AskStop | null;
  /** Questions this device holds for the surah whose sentences still exist, newest first. */
  entries: AskedEntry[];
  open: () => void;
  save: (entry: { question: string; atomIds: string[] }) => void;
  remove: (id: string) => void;
}
export const AskContext = createContext<AskState | null>(null);
/** `null` when «اسأل» is off (the static export) or outside the reader: every consumer then renders nothing. */
export const useAsk = () => useContext(AskContext);

