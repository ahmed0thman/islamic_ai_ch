"use client";

import { BookOpen01Icon } from "@hugeicons/core-free-icons";
import type { SourceRecord, Ui } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

export type StopSourcesProps = { records: SourceRecord[]; ui: Ui; onOpen: (records: SourceRecord[]) => void };
export function StopSources({ records, ui, onOpen }: StopSourcesProps) {
  return <Button className="stop-sources" variant="pill" size="lg" aria-haspopup="dialog" onClick={(event) => { event.currentTarget.focus({ preventScroll: true }); onOpen(records); }}><Icon icon={BookOpen01Icon} />{ui.reader.stop_sources}</Button>;
}
