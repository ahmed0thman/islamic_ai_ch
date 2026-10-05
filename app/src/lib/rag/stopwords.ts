import list from "./stopwords.json" with { type: "json" };

/** Normalised function words of the question language (a small list, so an empty list also works). */
export const STOPWORDS: ReadonlySet<string> = new Set(list as string[]);
