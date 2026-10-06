"use client";

import { Moon02Icon, Sun03Icon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/ui/icon";
import { useWideTheme } from "@/components/wide/theme-choice";
import { applyTheme } from "@/lib/reader-theme";
import type { Ui } from "@/lib/types";

/** One-click theme toggle switching between light and dark modes. */
export function ThemeToggle({ ui }: { ui: Ui }) {
  const { effective } = useWideTheme();
  const isDark = effective === "dark";
  const title = isDark ? ui.wide.theme_light : ui.wide.theme_dark;

  return (
    <button
      type="button"
      className="landing-theme-toggle"
      onClick={() => applyTheme(isDark ? "light" : "dark")}
      aria-label={ui.wide.theme}
      title={title}
    >
      <Icon icon={isDark ? Sun03Icon : Moon02Icon} size={20} />
    </button>
  );
}
