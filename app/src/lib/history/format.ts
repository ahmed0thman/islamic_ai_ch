/** The two pure shapings the history UI needs: filling a template's slots, and a date in Arabic. */

/** Arabic digits like the rest of the app's numerals (`numeral` uses the same numbering system); no project date helper existed. */
const dateFormatter = new Intl.DateTimeFormat("ar-EG-u-nu-arab", { dateStyle: "medium" });

/** `{key}` slots are replaced by their value; a slot with no value stays as it is, so it is visible, never silently dropped. */
export function fillSlots(template: string, slots: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (slot, key: string) => key in slots ? slots[key] : slot);
}

/** An epoch instant in the Arabic medium date style; anything else gives an empty string and the caller omits the line. */
export function formatDate(at: number): string {
  return Number.isFinite(at) && at > 0 ? dateFormatter.format(at) : "";
}
