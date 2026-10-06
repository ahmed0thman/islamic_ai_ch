import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import type { Ui } from "@/lib/types";
import { Icon } from "@/components/ui/icon";
import "./clerk.css";

/** Where the reader came from, as Clerk carries it in `redirect_url`. Only a surah page of this site is accepted; anything else goes to the first screen. */
export function backHref(from: string | string[] | undefined): string {
  try {
    const url = new URL(String(from), "http://local");
    return url.pathname.startsWith("/s/") ? url.pathname + url.search : "/";
  } catch { return "/"; }
}
/** The frame of the sign-in and sign-up pages: the app's name, a way back to the reading, then Clerk's form. */
export function AuthPage({ ui, back, children }: { ui: Ui; back: string; children: ReactNode }) {
  return <div className="auth-page">
    <header className="auth-head"><span className="auth-brand">{ui.app_name}</span><Link className="auth-back" href={back}><Icon icon={ArrowRight01Icon} />{ui.account.back}</Link></header>
    {children}
  </div>;
}
