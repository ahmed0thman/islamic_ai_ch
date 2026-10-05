"use client";

import { useEffect, useState } from "react";
import { Menu01Icon } from "@hugeicons/core-free-icons";
import type { Ui } from "@/lib/types";
import { jumpToAyah } from "@/lib/reader-dom";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { MenuDrawer } from "./menu-drawer";

export type AppMenuProps = { ui: Ui; current: number; ayahCount: number };
export function AppMenu({ ui, current, ayahCount }: AppMenuProps) {
  const [open, setOpen] = useState(false);
  // A search result in another surah arrives as `?ayah=N`: jump once the text is on the page, then drop the parameter.
  useEffect(() => {
    const url = new URL(window.location.href);
    const raw = url.searchParams.get("ayah");
    if (raw === null) return;
    const ayah = /^\d+$/.test(raw) ? Number(raw) : 0;
    const clean = () => {
      url.searchParams.delete("ayah");
      window.history.replaceState(window.history.state, "", url);
    };
    if (ayah < 1 || ayah > ayahCount) { clean(); return; }
    const key = `${current}:${ayah}`;
    let frame = 0, tries = 0;
    const attempt = () => {
      const found = Array.from(document.querySelectorAll<HTMLElement>("[data-station-key], [data-ayah-key]"))
        .some((element) => element.dataset.stationKey === key || element.dataset.ayahKey === key);
      if (found) { jumpToAyah(key); clean(); return; }
      tries += 1;
      if (tries >= 20) { clean(); return; }
      frame = requestAnimationFrame(attempt);
    };
    frame = requestAnimationFrame(attempt);
    return () => cancelAnimationFrame(frame);
  }, [current, ayahCount]);
  return <>
    <Button variant="quiet" size="icon" className="menu-trigger" aria-label={ui.menu.open} aria-haspopup="dialog" aria-expanded={open}
      onClick={(event) => { event.currentTarget.focus({ preventScroll: true }); setOpen(true); }}><Icon icon={Menu01Icon} /></Button>
    {open ? <MenuDrawer ui={ui} current={current} onClose={() => setOpen(false)} /> : null}
  </>;
}
