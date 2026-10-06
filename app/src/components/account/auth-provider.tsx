import type { ReactNode } from "react";
import type { Ui } from "@/lib/types";
import { getClerkStrings } from "@/lib/content";
import { envAuthUrls } from "@/lib/auth-urls";

type Strings = { [key: string]: string | Strings | undefined };
/** Clerk's Arabic strings with ours laid over them (`clerk` in ui.ar.json), and the app's own name in place of the one registered at Clerk. */
function localize(base: Strings, over: Strings, name: string): Strings {
  const out: Strings = {};
  for (const key of new Set([...Object.keys(base), ...Object.keys(over)])) {
    const mine = over[key], theirs = base[key], value = mine ?? theirs;
    if (typeof value === "string") out[key] = value.replaceAll("{{applicationName}}", name);
    else if (value) out[key] = localize(typeof theirs === "object" ? theirs : {}, typeof mine === "object" ? mine : {}, name);
  }
  return out;
}
/** Clerk wraps the page only when next.config.ts turns the flag on (a server build that has Clerk keys). The static export renders the children as they are. */
export async function AuthProvider({ ui, children }: { ui: Ui; children: ReactNode }) {
  if (process.env.NEXT_PUBLIC_HUDA_AUTH !== "1") return children;
  const [{ ClerkProvider }, { shadcn }, { arSA }, ours] = await Promise.all([import("@clerk/nextjs"), import("@clerk/ui/themes"), import("@clerk/localizations"), getClerkStrings()]);
  // The shadcn theme reads the app's colours. Clerk's styles go in the `components` layer, so clerk.css, which is unlayered, sets the shapes.
  // The paths are the code's own; the env names only override them. Without this, a service lacking the env would send the reader to Clerk's hosted pages.
  const urls = envAuthUrls();
  return <ClerkProvider {...urls} localization={localize(arSA as Strings, ours as Strings, ui.app_name)}
    appearance={{ theme: shadcn, cssLayerName: "components", options: { logoPlacement: "none" }, variables: { fontFamily: "var(--font-ui)", fontFamilyButtons: "var(--font-ui)", fontSize: "var(--text-ui)", borderRadius: "var(--radius-s)", colorBorder: "var(--border-ui)", colorMutedForeground: "var(--ink-2)", colorRing: "var(--accent)", colorWarning: "var(--gold-strong)" } }}>{children}</ClerkProvider>;
}
