import { createContext, useContext } from "react";
import type { Depth, SurahSummary } from "@/lib/types";
import type { AskedQuestion } from "@/lib/asked";
import type { AskExtra, AskResponse, PublicAtom } from "@/lib/ask/types";

/** The stop the reader has open, as «اسأل» needs it: its number at the current depth (the `?stop=N` of the URL) and the title the scene shows. */
export interface AskStop { number: number; title: string }
export type AskedEntry = { item: AskedQuestion; atoms: PublicAtom[] };

export interface AskTurn {
  id: number;
  question: string;
  loading: boolean;
  result: AskResponse | null;
}

export interface AskState {
  depth: Depth;
  stop: AskStop | null;
  /** Questions this device holds for the surah whose sentences still exist, newest first. */
  entries: AskedEntry[];
  /** True once a question save reached the signed-in reader's account; the asked note then says so. */
  accountSaved: boolean;
  open: () => void;
  save: (entry: { question: string; atomIds: string[]; held?: PublicAtom[]; heldContext?: AskExtra }) => void;
  remove: (id: string) => void;
  
  /** The published surahs, for naming the surah of a sentence that is not the open one. */
  surahs: SurahSummary[];
  /** The server weaves from book passages (known when the page was built); a reply can also say so. */
  sources: boolean;
  turns: AskTurn[];
  starters: string[];
  addTurn: (question: string) => number;
  settleTurn: (id: number, result: AskResponse) => void;
  dropTurn: (id: number) => void;
}
export const AskContext = createContext<AskState | null>(null);
/** `null` when «اسأل» is off (the static export) or outside the reader: every consumer then renders nothing. */
export const useAsk = () => useContext(AskContext);
