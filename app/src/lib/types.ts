export type Depth = 0 | 1 | 2 | 3;
export type IconKey = "ayah" | "hadith" | "athar" | "scholar" | "link" | "hidaya";
export type BadgeKey = "thabit" | "la_yathbut" | "khilaf_mutabar";
export type LinkStrength = "strong" | "medium" | "weak" | "unrated";
export interface SurahSummary { no: number; name: string; ayah_count: number }
export interface ContentIndex { surahs: SurahSummary[] }
export interface Ayah { key: string; no: number; text: string }
export type Segment =
  | { t: "text"; v: string }
  | { t: "ayah"; key: string }
  | { t: "quote"; v: string; record: string }
  | { t: "term"; v: string; record: string }
  | { t: "mark"; records: string[] };
export type TitleSegment = Extract<Segment, { t: "text" | "term" | "mark" }>;
export type ParagraphBlock = { type: "paragraph"; role: "claim" | "transmission"; segments: Segment[] };
export type Block =
  | { type: "heading"; text: string; kind?: "question" }
  | { type: "ayah"; keys: string[] }
  | ParagraphBlock
  | { type: "details"; title: TitleSegment[]; blocks: ParagraphBlock[] };
export interface Ruling { text: string; ruler: string; where: string }
export interface Evidence {
  icon: IconKey; source_title: string; author: string; locator: string;
  quote: string; url: string | null; rulings: Ruling[]; link_strength: LinkStrength | null;
}
export interface SourceRecord {
  id: string; icons: IconKey[]; badge: BadgeKey | null; claim: string;
  status_text: string; depth_min: Depth; evidence: Evidence[];
}
export interface Surah {
  schema: 1; fixture: boolean; surah: SurahSummary; ayahs: Ayah[];
  levels: { depth: Depth; blocks: Block[] }[];
  records: Record<string, SourceRecord>;
}
interface LegendEntry { color: string; label: string; meaning: string }
export interface Ui {
  draft: boolean; app_name: string; tagline: string;
  levels: { depth: Depth; name: string }[];
  icons: Record<IconKey, LegendEntry & { symbol: string }>;
  icon_order: IconKey[];
  badges: Record<BadgeKey, LegendEntry>;
  link_strength: Record<LinkStrength | "note", string>;
  panel: Record<"title" | "claim" | "source" | "author" | "locator" | "quote" | "ruling" | "ruler" | "open_source" | "close" | "no_badge", string>;
  legend: Record<"title" | "icons_title" | "badges_title" | "show" | "hide", string>;
  reader: Record<"choose_depth" | "ayahs_title" | "surahs_title" | "back" | "empty_level", string>;
  disclosure: Record<"ai" | "scripture" | "limits", string>;
  phrases: Record<"insufficient_sources" | "out_of_scope" | "arabic_only" | "fatwa", string>;
  links: Record<"fatwa" | "shubuhat", { label: string; url: string }>;
  privacy_line: string;
}
