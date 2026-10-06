import { numeral } from "@/lib/numerals";

/** A section title preceded by a small eyebrow row: a short accent dash plus the section number in numerals. */
export function SectionHeader({ number, title, className = "" }: { number?: number; title: string; className?: string }) {
  const classes = `landing-section-header ${className}`.trim();
  return (
    <div className={classes}>
      {number != null && (
        <div className="landing-eyebrow" aria-hidden="true">
          <span className="landing-eyebrow-dash" />
          <span className="landing-eyebrow-num">{numeral(number)}</span>
        </div>
      )}
      <h2 className="landing-section-title">{title}</h2>
    </div>
  );
}
