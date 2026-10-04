import type { Ui } from "@/lib/types";

export function Disclosure({ ui }: { ui: Ui }) {
  return <footer className="disclosure">
    <div className="disclosure-rule" aria-hidden="true" />
    <p>{ui.disclosure.ai}</p><p>{ui.disclosure.scripture}</p><p>{ui.disclosure.limits}</p>
    <p className="privacy">{ui.privacy_line}</p>
  </footer>;
}
