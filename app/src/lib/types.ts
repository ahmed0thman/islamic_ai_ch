export type Depth = 0 | 1 | 2 | 3;
export type IconKey = "ayah" | "hadith" | "athar" | "scholar" | "link" | "hidaya";
export type BadgeKey = "thabit" | "la_yathbut" | "khilaf_mutabar";
export type StateKey = "report_unjudged" | "source_direct";
export type LinkStrength = "strong" | "medium" | "weak" | "unrated";
export interface SurahSummary { no: number; name: string; ayah_count: number }
export interface ContentIndex { surahs: SurahSummary[] }
export interface Ayah { key: string; no: number; text: string }
export type Segment =
  | { t: "text"; v: string }
  | { t: "ayah"; key: string }
  | { t: "quote"; v: string; record: string; /** Display only: punctuation that followed the closing mark. Never in content. */ trail?: string }
  | { t: "term"; v: string; record: string }
  | { t: "mark"; records: string[] };
export type TitleSegment = Extract<Segment, { t: "text" | "term" | "mark" }>;
/** `kind: "summary"` marks the closing synthesis of a level: a claim with no title and no ayahs, shown on its own screen after the last stop (never a stop). */
export type ParagraphBlock = { type: "paragraph"; role: "claim" | "transmission" | "example"; kind?: "summary" | "misconception"; title?: string; ayahs?: string[]; passage?: string; segments: Segment[] };
export type Block = (
  | { type: "heading"; text: string; kind?: "question" }
  | { type: "ayah"; keys: string[] }
  | ParagraphBlock
  | { type: "details"; title: TitleSegment[]; blocks: ParagraphBlock[] }
) & { passage?: string };
export interface Passage { id: string; from: string; to: string; title: string; records: string[] }
export interface Ruling { text: string; ruler: string; where: string }
export interface Evidence {
  icon: IconKey; source_title: string; author: string; locator: string;
  quote: string; url: string | null; rulings: Ruling[]; link_strength: LinkStrength | null;
}
export interface SourceRecord {
  id: string; icons: IconKey[]; badge: BadgeKey | null; state?: StateKey; claim: string;
  status_text: string; depth_min: Depth; ayah_keys: string[]; evidence: Evidence[];
  /** Term records only: a key of `ui.sciences`. */
  science?: string | null;
  /** Term records only: the approved name of the term (a noun phrase), shown on its chip and as its panel title. Absent: the wording of the text is used. */
  term?: string;
}
export interface Surah {
  schema: 1; fixture: boolean; surah: SurahSummary; ayahs: Ayah[];
  passages?: Passage[];
  levels: { depth: Depth; blocks: Block[] }[];
  records: Record<string, SourceRecord>;
}
interface LegendEntry { color: string; label: string; meaning: string }
interface TitledText { title: string; body: string }
interface TitledList { title: string; items: string[] }
/** The introduction page. `today.count` carries a `{count}` slot that the page fills from the published list; no number of surahs is written in the text. */
export interface LandingUi {
  label: string; back_link: string; hero: Record<"lead" | "sub", string>;
  enter: string; guide_link: string; surahs_title: string;
  audience: { title: string; body: string[] };
  problem: { title: string; body: string[]; items: { title: string; body: string }[] };
  journey: {
    title: string;
    lead: string;
    items: {
      kind: "question" | "science" | "term" | "state" | "misconception" | "example";
      title: string;
      body: string;
      tags: string[];
    }[];
  };
  how: { title: string; items: TitledText[] };
  ai: TitledList & { note: string };
  today: TitledList & { count: string };
  in_progress: TitledList;
  planned: TitledList & { note: string };
  nav: Record<"label" | "journey" | "how" | "trust" | "status" | "surahs", string>;
  footer: { note: string };
}
/** The first-visit guide of the reader. `shared` steps open both tours; `progress` carries `{current}` and `{total}` slots. */
export interface GuideUi extends Record<"title" | "reopen" | "next" | "previous" | "skip" | "done" | "progress", string> {
  shared: Record<"welcome" | "depth", TitledText>;
  phone: Record<"stop" | "marks" | "views" | "ask" | "menu", TitledText>;
  wide: Record<"index" | "reading" | "panel" | "ask" | "tools", TitledText>;
}
/** The signed-in reader's history. Slots: `{stop}`, `{depth}`, `{visited}`, `{total}`, `{count}`, `{date}`. */
export interface HistoryUi extends Record<"title" | "resume_title" | "resume_body" | "resume_action" | "resume_dismiss" | "empty" | "signed_out" | "row_progress" | "row_questions" | "last_seen" | "questions_title" | "saved_in_account" | "open_surah", string> {}
export interface Ui {
  draft: boolean; app_name: string; tagline: string;
  levels: { depth: Depth; name: string }[];
  icons: Record<IconKey, LegendEntry & { symbol: string; short?: string }>;
  icon_order: IconKey[];
  badges: Record<BadgeKey, LegendEntry>;
  states: Record<StateKey, LegendEntry>;
  link_strength: Record<LinkStrength | "note", string>;
  /** Display names of the sciences, by the keys a term record carries. May be absent from the dictionary. */
  sciences?: Record<string, string>;
  example: { label: string };
  terms_summary: Record<"title" | "terms" | "sciences" | "other", string>;
  summary: Record<"title" | "parts" | "open", string>;
  weave: Record<"badge" | "ready" | "open" | "back" | "note" | "from_question" | "trigger" | "instruction" | "failed", string>;
  misconception: Record<"badge" | "intro" | "back", string>;
  account: Record<"sign_in" | "sign_up" | "back", string>;
  landing: LandingUi;
  guide: GuideUi;
  history: HistoryUi;
  settings: Record<"title" | "open" | "appearance" | "model" | "account" | "back" | "key_needed" | "open_from_ask", string>;
  wide: Record<"skip" | "toc" | "purpose" | "ayah_one" | "ayah_few" | "tab_passage" | "tab_source" | "tab_term" | "tab_ask" | "tab_weave" | "passage_sources" | "all_sources" | "source_hint" | "term_hint" | "weave_empty" | "shortcuts" | "theme" | "theme_light" | "theme_dark" | "theme_system" | "account" | "panel_hide" | "panel_show" | "expand_all" | "collapse_all" | "load_failed", string> & Partial<Record<"reading_region" | "context_region", string>>;
  judge_key: Record<"open" | "title" | "intro" | "provider" | "key" | "test" | "save" | "clear" | "checking" | "ok" | "bad" | "using" | "in_use" | "use_this" | "empty" | "clear_all", string> & {
    providers: Record<"openai" | "gemini" | "groq", string>;
    hints: Record<"openai" | "gemini" | "groq", string>;
  };
  panel: Record<"title" | "claim" | "source" | "author" | "locator" | "quote" | "ruling" | "ruler" | "open_source" | "close" | "no_badge" | "takhrij" | "for_text" | "sources_count", string> & { science_of: string };
  legend: Record<"title" | "icons_title" | "badges_title" | "show" | "hide", string>;
  reader: Record<"choose_depth" | "ayahs_title" | "surahs_title" | "back" | "empty_level"
    | "map_view" | "read_continuous" | "next_stop" | "previous_stop" | "why_next" | "next_surah"
    | "open_term" | "passages_title" | "range" | "read_this" | "stop_sources" | "retry" | "shelf_title" | "depth_item" | "unit_whole" | "unit_ayah" | "unit_ayahs", string>;
  menu: Record<"open" | "title" | "tab_mushaf" | "tab_about" | "search_label" | "search_placeholder" | "search_clear" | "surah_word" | "available_title" | "all_title" | "group_by" | "by_juz" | "by_hizb" | "by_quarter" | "juz" | "hizb" | "continues" | "from_ayah" | "results_explained" | "more_results" | "no_results" | "loading_ayahs" | "ayahs_failed" | "soon" | "scope_note", string> & { quarter_names: string[] };
  disclosure: Record<"ai" | "scripture" | "limits", string>;
  phrases: Record<"insufficient_sources" | "out_of_scope" | "arabic_only" | "fatwa", string>;
  links: Record<"fatwa" | "shubuhat", { label: string; url: string }>;
  privacy_line: string;
  ask: Record<"title" | "placeholder" | "submit" | "loading" | "answer_title" | "note" | "unavailable" | "open" | "title_stop" | "about_stop" | "whole_surah" | "from_level" | "your_questions" | "your_question" | "saved_on_device" | "remove" | "followups_title" | "followups_from_you" | "composed_note" | "show_verified" | "hide_verified" | "example_note"
    | "voice_start" | "voice_stop" | "voice_recording" | "voice_listening" | "voice_live_note" | "voice_transcribing" | "voice_review" | "voice_partial" | "voice_denied" | "voice_failed" | "voice_privacy"
    | "voice_hint_intro" | "voice_hint_stop" | "voice_hint_scholars" | "voice_hint_terms" | "voice_hint_words"
    | "ai_badge" | "starters_title" | "voice_listening_title" | "voice_listening_hint" | "from_surah" | "report_note" | "note_sources", string>;
}
