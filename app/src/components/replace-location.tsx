"use client";

import { useEffect } from "react";

/** Sends the page on at once when scripts run; the meta refresh beside it does the same without them. */
export function ReplaceLocation({ to }: { to: string }) {
  useEffect(() => { window.location.replace(to); }, [to]);
  return null;
}
