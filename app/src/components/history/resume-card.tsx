"use client";

import { Button } from "@/components/ui/button";
import { fillSlots } from "@/lib/history/format";
import { numeral } from "@/lib/numerals";
import type { Ui } from "@/lib/types";

export interface ResumeCardProps { ui: Ui; stop: number; depthName: string; onResume: () => void; onDismiss: () => void }

/** The saved place, offered once at the top of the reading area; nothing ever jumps by itself. */
export function ResumeCard({ ui, stop, depthName, onResume, onDismiss }: ResumeCardProps) {
  return <section className="history-resume" aria-label={ui.history.resume_title}>
    <p className="history-resume-title">{ui.history.resume_title}</p>
    <p className="history-resume-body">{fillSlots(ui.history.resume_body, { stop: numeral(stop), depth: depthName })}</p>
    <div className="history-resume-actions">
      <Button variant="primary" size="sm" onClick={onResume}>{ui.history.resume_action}</Button>
      <Button variant="quiet" size="sm" onClick={onDismiss}>{ui.history.resume_dismiss}</Button>
    </div>
  </section>;
}
