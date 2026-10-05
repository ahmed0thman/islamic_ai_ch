import type { AskResponse, PublicAtom } from "./ask/types";

export type ComposedWrittenItem = { kind: "written"; text: string; atoms: PublicAtom[]; records: string[] };
export type ComposedVerbatimItem = { kind: "verbatim"; atoms: PublicAtom[] };
/** An everyday illustration written by the model: no atoms, no records, no marker. */
export type ComposedExampleItem = { kind: "example"; text: string };
export type ComposedItem = ComposedWrittenItem | ComposedVerbatimItem | ComposedExampleItem;
/** As the server sends it, only wider: the brief allows a composed item without `text`, and an example carries no atom ids. */
export type ComposedResponse = Omit<AskResponse, "composed"> & { composed?: { kind?: "example"; text?: string; atom_ids?: string[] }[] };

/** Union of the atoms' record ids, each once, in the order they were first seen. */
function unionRecords(atoms: PublicAtom[]): string[] {
  const records: string[] = [];
  const seen = new Set<string>();
  for (const atom of atoms) // A book excerpt has no record of ours: its marker opens the stand-in record made from the atom itself (see ask-client.ts).
  for (const record of atom.role === "source" ? [atom.id] : atom.records) {
    if (seen.has(record)) continue;
    seen.add(record);
    records.push(record);
  }
  return records;
}

/**
 * The written answer and its evidence, side by side. `text` is the system's wording; the verified
 * sentences under it are what it rests on. Anything less keeps the plain, extractive atom list.
 */
export function composedView(response: ComposedResponse): ComposedItem[] | null {
  if (response.status !== "answer" || response.mode !== "composed") return null;
  if (!Array.isArray(response.composed) || !response.composed.length) return null;
  const byId = new Map(response.atoms.map((atom) => [atom.id, atom]));
  const items: ComposedItem[] = [];
  for (const { kind, text, atom_ids } of response.composed) {
    if (kind === "example") {
      if (text) items.push({ kind: "example", text });
      continue;
    }
    const atoms = (atom_ids ?? []).map((id) => byId.get(id)).filter((atom): atom is PublicAtom => atom !== undefined);
    if (!text) {
      if (atoms.length) items.push({ kind: "verbatim", atoms });
      continue;
    }
    if (!atoms.length) continue;
    items.push({ kind: "written", text, atoms, records: unionRecords(atoms) });
  }
  return items.some((item) => item.kind === "written") ? items : null;
}
