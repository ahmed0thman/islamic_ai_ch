"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowDown01Icon, BubbleChatQuestionIcon, Cancel01Icon, HelpCircleIcon, HistoryIcon, Key01Icon, KeyboardIcon, Moon02Icon, Sun03Icon, Settings01Icon, SidebarLeftIcon, RightToLeftListBulletIcon } from "@hugeicons/core-free-icons";
import type { Depth, Surah, SurahSummary, Ui } from "@/lib/types";
import type { SurahMapModel } from "@/lib/map";
import type { DepthItemsModel, SceneUnit } from "@/lib/depth-items";
import { wideIndex, unitAtAyah, indexQuestion } from "@/lib/wide-index";
import { wideCommand, wideEscapeAction } from "@/lib/wide-keyboard";
import { widePopoverPosition } from "@/lib/wide-popover";
import { requestGuide } from "@/lib/guide";
import { numeral } from "@/lib/numerals";
import type { Followup } from "@/lib/followups";
import { Icon } from "@/components/ui/icon";
import { SkipLink } from "@/components/ui/skip-link";
import { SourceChip } from "@/components/ui/source-chip";
import { SourceMarker } from "@/components/reader/source-marker";
import { useSheets } from "@/components/reader/sheet-provider";
import { useAsk } from "@/components/reader/ask-state";
import { useSettings } from "@/components/settings/settings";
import { UserBadge, SignInEntry } from "@/components/account/account";
import { HistoryList } from "@/components/history/history-list";
import { WideThemeMenu, useWideTheme } from "./theme-choice";
import { Disclosure } from "@/components/disclosure";
import { WideContext } from "./wide-context";
import { useWideSurface, type WideTab } from "./wide-surface";
import { currentWideAyah, restoreWideAyah, WIDE_READING_LINE } from "./wide-position";

type Props = { surah: Surah; surahs: SurahSummary[]; ui: Ui; depth: Depth; view: "map" | "text"; map: SurahMapModel; items: DepthItemsModel; stop?: SceneUnit; closing: boolean; weave: boolean; followups: Followup[]; children: ReactNode; onDepth: (depth: Depth) => void; onView: (view: "map" | "text") => void; onStop: (stop: SceneUnit) => void; onBack: () => void; onClosing: () => void; onPassage: (id: string) => void };
export function WideReader(props: Props) {
  const surface = useWideSurface()!;
  return surface.wide ? <WideLayout {...props} /> : <>{props.children}</>;
}
function WideLayout({ surah, surahs, ui, depth, view, map, items, stop, closing, weave, followups, children, onDepth, onView, onStop, onBack, onClosing, onPassage }: Props) {
  const surface = useWideSurface()!;
  const sheets = useSheets();
  const ask = useAsk();
  const theme = useWideTheme();
  const model = useMemo(() => wideIndex(surah, map, items), [surah, map, items]);
  const [ayah, setAyah] = useState<string | null>(stop?.stationKey || null);
  const [trackedUnit, setTrackedUnit] = useState<number | null>(null);
  const pendingPassage = useRef<string | null>(null);
  const onPassageRef = useRef(onPassage); onPassageRef.current = onPassage;
  const [drawer, setDrawer] = useState(false);
  const [localPopover, setLocalPopover] = useState<"surahs" | "shortcuts" | "theme" | "history" | null>(null);
  const settings = useSettings();
  const [query, setQuery] = useState("");
  const [expand, setExpand] = useState(false);
  const rail = useRef<HTMLDivElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const detailHost = useCallback((node: HTMLDivElement | null) => surface.setHost("detail", node), [surface.setHost]);
  const askHost = useCallback((node: HTMLDivElement | null) => surface.setHost("ask", node), [surface.setHost]);
  const popoverHost = useCallback((node: HTMLDivElement | null) => surface.setHost("popover", node), [surface.setHost]);
  const currentUnit = closing ? undefined : stop ?? (view === "text" ? model.units.find((unit) => unit.number === trackedUnit) : undefined) ?? unitAtAyah(model.units, ayah);
  useEffect(() => {
    const flat = (segments: Followup["title"]) => segments.map((segment) => segment.t === "text" || segment.t === "term" ? segment.v : "").join("");
    const candidates = stop ? followups.map((item) => flat(item.title)) : surah.levels.filter((level) => level.depth > depth).flatMap((level) => level.blocks.flatMap((block) => block.type === "paragraph" && block.title ? [block.title] : block.type === "details" ? [flat(block.title)] : []));
    const questions = candidates.flatMap((title) => { const at = title.indexOf("\u061f"); return at >= 0 ? [title.slice(0, at + 1)] : []; });
    surface.setSuggestions([...new Set(questions)].slice(0, 3));
  }, [surah, depth, stop, followups, surface.setSuggestions]);
  const tabs: WideTab[] = ["passage", "source", "term", ...(ask ? ["ask" as const] : []), ...(weave ? ["weave" as const] : [])];
  const popoverTitle = localPopover === "surahs" ? ui.reader.surahs_title : localPopover === "history" ? ui.history.title : localPopover ? ui.wide[localPopover] : "";
  const closeLocal = useCallback((refocus = true) => { setLocalPopover(null); if (refocus) opener.current?.focus({ preventScroll: true }); }, []);
  function togglePopover(value: NonNullable<typeof localPopover>, element?: HTMLElement) {
    if (localPopover === value) { closeLocal(); return; }
    surface.closePopover(false); if (element) opener.current = element;
    setLocalPopover(value);
  }
  function openAsk(focus = false) {
    if (!ask) return;
    closeLocal(false); surface.closePopover(false); surface.selectTab("ask"); ask.open();
    if (focus) requestAnimationFrame(() => requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>(".wide-ask-host .ask-input")?.focus({ preventScroll: true })));
  }
  function openLegend(element: HTMLElement) {
    closeLocal(false);
    if (sheets.legendOpen && surface.popoverAnchor === element) { surface.closePopover(); return; }
    const open = () => { element.focus({ preventScroll: true }); sheets.openLegend(); };
    if (surface.closePopover(false)) requestAnimationFrame(open);
    else open();
  }
  function selectTab(next: WideTab) {
    surface.selectTab(next); if (next === "ask") openAsk();
  }
  useEffect(() => {
    if (closing) { setAyah(null); setTrackedUnit(null); return; }
    if (stop) { setAyah(stop.stationKey || stop.ayahKeys[0] || null); return; }
    const update = () => {
      const key = currentWideAyah(); setAyah(key);
      let number: number | null = null;
      for (const node of document.querySelectorAll<HTMLElement>(".wide-reading [data-wide-unit]")) if (node.getBoundingClientRect().height && node.getBoundingClientRect().top <= WIDE_READING_LINE + 2) number = Number(node.dataset.wideUnit);
      setTrackedUnit(number);
    };
    let frame = 0;
    const scroll = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; update(); }); };
    update(); window.addEventListener("scroll", scroll, { passive: true }); window.addEventListener("resize", scroll);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", scroll); window.removeEventListener("resize", scroll); };
  }, [stop, closing, map, view]);
  useEffect(() => {
    if (stop || closing || !pendingPassage.current) return;
    const id = pendingPassage.current; pendingPassage.current = null;
    let inner = 0;
    const frame = requestAnimationFrame(() => { inner = requestAnimationFrame(() => onPassageRef.current(id)); });
    return () => { cancelAnimationFrame(frame); cancelAnimationFrame(inner); };
  }, [stop, closing]);
  function goPassage(id: string) {
    if (stop || closing) { pendingPassage.current = id; onBack(); }
    else onPassage(id);
    setDrawer(false);
  }
  function goSummary() {
    if (view === "text") document.querySelector<HTMLElement>(".wide-reading .closing")?.scrollIntoView({ block: "start", behavior: "auto" });
    else onClosing();
    setDrawer(false);
  }
  useEffect(() => {
    const current = rail.current?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!current || !rail.current) return;
    const bounds = rail.current.getBoundingClientRect(), rect = current.getBoundingClientRect();
    if (rect.top < bounds.top || rect.bottom > bounds.bottom) rail.current.scrollTop += rect.top - bounds.top - 32;
  }, [currentUnit?.number, ayah]);
  useEffect(() => {
    if (!localPopover && !surface.hasPopover) return;
    if (localPopover) (popover.current?.querySelector<HTMLElement>("input") ?? popover.current?.querySelector<HTMLElement>("select, button"))?.focus({ preventScroll: true });
    const anchor = localPopover ? opener.current : surface.popoverAnchor;
    const outside = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || popover.current?.contains(event.target) || anchor?.contains(event.target)) return;
      const nextTrigger = event.target.closest(".wide-surah-picker, .wide-shortcut-trigger, .wide-theme-trigger, .wide-history-trigger, .wide-settings-trigger, .wide-legend-trigger, .wide-index-legend button");
      if (!nextTrigger) event.preventDefault();
      if (localPopover) closeLocal(!nextTrigger); else surface.closePopover(!nextTrigger);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [localPopover, surface.hasPopover, surface.popoverAnchor, closeLocal, surface.closePopover]);
  useLayoutEffect(() => {
    const box = popover.current, anchor = localPopover ? opener.current : surface.popoverAnchor;
    if ((!localPopover && !surface.hasPopover) || !box || !anchor) return;
    const position = () => {
      const rect = box.getBoundingClientRect();
      const next = widePopoverPosition(anchor.getBoundingClientRect(), rect, { width: window.innerWidth, height: window.innerHeight });
      box.style.left = `${next.left}px`; box.style.top = `${next.top}px`;
    };
    position();
    const observer = new ResizeObserver(position); observer.observe(box);
    window.addEventListener("resize", position); window.addEventListener("scroll", position, { passive: true, capture: true });
    return () => { observer.disconnect(); window.removeEventListener("resize", position); window.removeEventListener("scroll", position, true); };
  }, [localPopover, surface.hasPopover, surface.popoverAnchor]);
  useEffect(() => {
    function keyboard(event: KeyboardEvent) {
      const target = event.target;
      const editing = target instanceof HTMLElement && Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
      const command = wideCommand(event, editing);
      if (!command) return;
      // Tabs and radio groups own their arrow navigation.
      if (command.kind === "step" && target instanceof HTMLElement && target.closest("[role='tablist'], [role='radiogroup']")) return;
      if (command.kind === "escape") {
        event.preventDefault();
        const action = wideEscapeAction({ editing, popover: Boolean(localPopover || surface.hasPopover), drawer, detail: Boolean(surface.detailTab && surface.tab === surface.detailTab), passage: surface.tab === "passage", scene: Boolean(stop || closing) });
        if (action === "blur" && target instanceof HTMLElement) target.blur();
        else if (action === "popover") { if (localPopover) closeLocal(); else surface.closePopover(); }
        else if (action === "drawer") { setDrawer(false); document.querySelector<HTMLElement>(".wide-toc-toggle")?.focus({ preventScroll: true }); }
        else if (action === "detail") surface.closeDetail();
        else if (action === "passage") { surface.selectTab("passage"); document.getElementById("wide-tab-passage")?.focus({ preventScroll: true }); }
        else if (action === "map") onBack();
        return;
      }
      if (command.kind === "shortcuts") { event.preventDefault(); togglePopover("shortcuts", document.querySelector<HTMLElement>(".wide-shortcut-trigger") ?? undefined); return; }
      if (localPopover || surface.hasPopover || drawer) return;
      if (command.kind === "ask") { if (ask) { event.preventDefault(); openAsk(true); } return; }
      event.preventDefault();
      if (command.kind === "depth") onDepth(command.depth);
      else if (command.kind === "view") onView(view === "map" ? "text" : "map");
      else if (command.kind === "step") {
        const list = stop?.kind === "section" ? items.shelf : stop?.kind === "pin" ? items.pins : map.stops.length ? [...map.stops].sort((a, b) => a.blockIndex - b.blockIndex) : model.units;
        const at = list.findIndex((item) => item.number === currentUnit?.number);
        const next = closing ? command.direction < 0 ? list.at(-1) : undefined : view === "map" && !stop ? command.direction > 0 ? list[0] : undefined : list[at + command.direction] ?? (at < 0 && command.direction > 0 ? list[0] : undefined);
        if (next) go(next);
        else if (command.direction > 0 && stop && map.summary) onClosing();
      }
    }
    document.addEventListener("keydown", keyboard);
    return () => document.removeEventListener("keydown", keyboard);
  });
  function go(unit: SceneUnit) {
    if (view === "map") onStop(unit); else { restoreWideAyah(unit.stationKey); document.querySelector<HTMLElement>(`.wide-reading [data-wide-unit="${unit.number}"]`)?.scrollIntoView({ block: "start", behavior: "auto" }); }
    setDrawer(false);
  }
  const iconButton = (label: string, icon: Parameters<typeof Icon>[0]["icon"], act: (element: HTMLElement) => void, expanded?: boolean, className = "") => <button type="button" className={`wide-icon-button ${className}`} aria-label={label} title={label} aria-expanded={expanded} onClick={(event) => act(event.currentTarget)}><Icon icon={icon} /></button>;
  return <div className="wide-reader" data-panel={surface.panelOpen ? "open" : "closed"} data-drawer={drawer ? "open" : "closed"}>
    <SkipLink href="#wide-reading">{ui.wide.skip}</SkipLink>
    <header className="wide-bar"><div className="wide-bar-start">
      {iconButton(ui.wide.toc, RightToLeftListBulletIcon, () => setDrawer((value) => !value), drawer, "wide-toc-toggle")}
      <a className="wide-brand" href="/" title={ui.landing.back_link}>{ui.app_name}</a><button className="wide-surah-picker" type="button" aria-expanded={localPopover === "surahs"} aria-haspopup="dialog" onClick={(event) => togglePopover("surahs", event.currentTarget)}>{surah.surah.name}<Icon icon={ArrowDown01Icon} size={16} /></button>
    </div><div className="wide-tabs wide-depths" role="group" aria-label={ui.reader.choose_depth}>{ui.levels.map((level) => <button type="button" className="wide-tab" key={level.depth} aria-pressed={level.depth === depth} onClick={() => onDepth(level.depth)}>{level.name}</button>)}</div>
    <div className="wide-bar-end">{ask ? <button className="wide-ask-open" type="button" aria-label={ui.ask.placeholder} title={ui.ask.placeholder} onClick={() => openAsk(true)}><Icon icon={BubbleChatQuestionIcon} size={16} /><span>{ui.ask.placeholder}</span><kbd>/</kbd></button> : null}
      {iconButton(ui.legend.title, Key01Icon, openLegend, sheets.legendOpen && surface.popoverAnchor?.classList.contains("wide-legend-trigger"), "wide-legend-trigger")}
      {iconButton(ui.wide.shortcuts, KeyboardIcon, (element) => togglePopover("shortcuts", element), localPopover === "shortcuts", "wide-shortcut-trigger")}
      {iconButton(ui.guide.reopen, HelpCircleIcon, () => { closeLocal(false); surface.closePopover(false); requestGuide(); }, undefined, "wide-guide-trigger")}
      {iconButton(ui.wide.theme, theme.effective === "dark" ? Moon02Icon : Sun03Icon, (element) => togglePopover("theme", element), localPopover === "theme", "wide-theme-trigger")}
      {iconButton(ui.settings.open, Settings01Icon, () => { closeLocal(false); if (settings.isOpen) settings.close(); else settings.open(Boolean(ask)); }, settings.isOpen, "wide-settings-trigger")}
      {process.env.NEXT_PUBLIC_HUDA_AUTH === "1" ? <div className="wide-account" aria-label={ui.wide.account}>{iconButton(ui.history.title, HistoryIcon, (element) => togglePopover("history", element), localPopover === "history", "wide-history-trigger")}<UserBadge /><SignInEntry ui={ui} onAct={(act) => act()} /></div> : null}
      {!surface.panelOpen ? iconButton(ui.wide.panel_show, SidebarLeftIcon, () => surface.setPanelOpen(true), undefined, "wide-panel-show") : null}
    </div></header>
    <div className="wide-grid"><nav className="wide-index" aria-label={ui.wide.toc}><div className="wide-index-scroll" ref={rail}>
      <div className="wide-index-head"><div className="wide-index-heading"><p className="sheet-label">{ui.wide.toc}</p><p className="wide-index-count">{numeral(surah.surah.ayah_count)} {surah.surah.ayah_count >= 3 && surah.surah.ayah_count <= 10 ? ui.wide.ayah_few : ui.wide.ayah_one}</p></div>
        {model.purpose ? <><h2>{ui.wide.purpose}</h2><p data-run="wide-purpose">{model.purpose.claim}<SourceMarker records={[model.purpose]} ui={ui} onOpen={() => sheets.openSource([model.purpose!])} /></p></> : null}
      </div><div className="wide-index-list">{model.groups.map((group, index) => <section key={group.passage?.id ?? "surah"}>
        <button type="button" className="wide-index-passage" aria-current={!closing && !currentUnit && group.stations.some((station) => station.ayah.key === ayah) || undefined} onClick={() => { if (group.passage) goPassage(group.passage.id); else { if (stop || closing) onBack(); else restoreWideAyah(group.stations[0]?.ayah.key ?? null); setDrawer(false); } }}><span>{group.passage?.title ?? surah.surah.name}</span><small><bdi dir="ltr">{numeral(group.stations[0]?.ayah.no ?? 1)}–{numeral(group.stations.at(-1)?.ayah.no ?? surah.surah.ayah_count)}</bdi></small></button>
        <ul>{group.units.map((unit) => <li key={unit.number}><button className="wide-index-unit" type="button" aria-current={currentUnit?.number === unit.number || undefined} onClick={() => go(unit)}><span>{indexQuestion(unit.title)}</span><small><bdi dir="ltr">{unit.ayahKeys.length ? [...new Set(unit.ayahKeys.map((key) => Number(key.split(":")[1])))].sort((a, b) => a - b).filter((_, at, values) => at === 0 || at === values.length - 1).map(numeral).join("–") : numeral(index + 1)}</bdi></small></button></li>)}</ul>
      </section>)}{model.shelf.map((unit) => <button className="wide-index-unit" type="button" key={unit.number} aria-current={currentUnit?.number === unit.number || undefined} onClick={() => go(unit)}>{indexQuestion(unit.title)}</button>)}{map.summary ? <button type="button" className="wide-index-passage" aria-current={closing || undefined} onClick={goSummary}>{ui.summary.open}</button> : null}</div>
    </div><div className="wide-index-legend"><button type="button" aria-expanded={sheets.legendOpen && surface.popoverAnchor?.classList.contains("wide-legend-foot")} className="wide-legend-foot" onClick={(event) => openLegend(event.currentTarget)}><Icon icon={Key01Icon} size={16} />{ui.legend.title}</button><div>{ui.icon_order.map((kind) => <button type="button" key={kind} aria-expanded={sheets.legendOpen && surface.popoverAnchor?.dataset.legendKind === kind} data-legend-kind={kind} onClick={(event) => openLegend(event.currentTarget)} title={ui.icons[kind].meaning}><SourceChip kind={kind} ui={ui} size="small" />{ui.icons[kind].short ?? ui.icons[kind].label}</button>)}</div></div></nav>
    <section className="wide-reading" id="wide-reading" tabIndex={-1} aria-label={ui.wide.reading_region ?? [ui.reader.ayahs_title, ui.wide.tab_passage].join(" / ")}><div className="wide-document">
      {!stop && !closing ? <h1 className="wide-surah-title">{surah.surah.name}</h1> : null}
      <div className="wide-view-row"><div className="wide-tabs" role="group" aria-label={ui.reader.read_this}>{(["map", "text"] as const).map((value) => <button type="button" className="wide-tab" key={value} aria-pressed={view === value} onClick={() => onView(value)}>{value === "map" ? ui.reader.map_view : ui.reader.read_continuous}</button>)}</div>
        {view === "text" && map.continuousBlocks.some((block) => block.type === "details") ? <button type="button" className="wide-link" onClick={() => { const next = !expand; setExpand(next); document.querySelectorAll<HTMLDetailsElement>(".wide-reading .details-item").forEach((item) => { item.open = next; }); }}>{expand ? ui.wide.collapse_all : ui.wide.expand_all}</button> : null}
      </div>{!stop && !closing ? <p className="wide-disclosure">{ui.disclosure.ai}</p> : null}{children}<Disclosure ui={ui} />
    </div></section>
    <aside className="wide-panel" aria-label={ui.wide.context_region ?? [ui.wide.tab_passage, ui.wide.tab_source, ui.wide.tab_term].join(" / ")} hidden={!surface.panelOpen}><div className="wide-panel-tabs"><div className="wide-tabs" role="tablist" aria-label={ui.wide.context_region ?? [ui.wide.tab_passage, ui.wide.tab_source, ui.wide.tab_term].join(" / ")}>
      {tabs.map((tab) => <button type="button" key={tab} className="wide-tab" id={`wide-tab-${tab}`} role="tab" aria-selected={surface.tab === tab} aria-controls={`wide-panel-${tab}`} tabIndex={surface.tab === tab ? 0 : -1} onClick={() => selectTab(tab)} onKeyDown={(event) => { if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home" && event.key !== "End") return; event.preventDefault(); event.stopPropagation(); const at = tabs.indexOf(tab); const next = event.key === "Home" ? tabs[0] : event.key === "End" ? tabs.at(-1)! : tabs[(at + (event.key === "ArrowLeft" ? 1 : -1) + tabs.length) % tabs.length]; selectTab(next); document.getElementById(`wide-tab-${next}`)?.focus({ preventScroll: true }); }}>{ui.wide[`tab_${tab}`]}</button>)}
    </div>{iconButton(ui.wide.panel_hide, SidebarLeftIcon, () => { surface.setPanelOpen(false); requestAnimationFrame(() => document.querySelector<HTMLElement>(".wide-panel-show")?.focus({ preventScroll: true })); })}</div>
      {tabs.map((tab) => <div className={`wide-panel-slot${tab === "ask" ? " wide-ask-host" : ""}`} key={tab} id={`wide-panel-${tab}`} role="tabpanel" aria-labelledby={`wide-tab-${tab}`} hidden={surface.tab !== tab} ref={tab === "ask" ? askHost : undefined}>
        {tab !== "ask" && !(surface.detailTab === tab && (tab === "source" || tab === "term")) ? <WideContext tab={tab} surah={surah} depth={depth} stop={stop} ayah={closing ? null : ayah} closing={closing} /> : null}
      </div>)}
      <div className="wide-detail-host" ref={detailHost} hidden={surface.tab !== surface.detailTab} />
    </aside></div>
    {drawer ? <button type="button" className="wide-index-scrim" aria-label={ui.panel.close} onClick={() => setDrawer(false)} /> : null}
    <div className="wide-popover-position" ref={popover} hidden={!localPopover && !surface.hasPopover}><div ref={popoverHost} />{localPopover ? <section className="wide-local-popover" role="dialog" aria-label={popoverTitle}><header><h2>{popoverTitle}</h2>{iconButton(ui.panel.close, Cancel01Icon, () => closeLocal())}</header>
      {localPopover === "theme" ? <WideThemeMenu ui={ui} onChoose={() => closeLocal()} /> : localPopover === "history" ? <HistoryList ui={ui} /> : localPopover === "surahs" ? <><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} aria-label={ui.menu.search_label} placeholder={ui.menu.search_placeholder} /><ul>{surahs.filter((item) => !query || item.name.includes(query) || String(item.no) === query).map((item) => <li key={item.no}><a href={`/s/${item.no}/`} aria-current={item.no === surah.surah.no ? "page" : undefined}>{item.name}<small>{numeral(item.ayah_count)}</small></a></li>)}</ul></> : <ul className="wide-shortcuts">{[[ui.reader.next_stop, "J / ArrowLeft"], [ui.reader.previous_stop, "K / ArrowRight"], [ui.reader.choose_depth, "1 2 3 4"], [ui.reader.map_view + " / " + ui.reader.read_continuous, "M"], ...(ask ? [[ui.ask.open, "/"]] : []), [ui.panel.close, "Escape"], [ui.wide.shortcuts, "?"]].map(([label, key]) => <li key={key}><span>{label}</span><kbd>{key}</kbd></li>)}</ul>}
    </section> : null}</div>
  </div>;
}
