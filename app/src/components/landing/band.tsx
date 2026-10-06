import type { ElementType, ReactNode } from "react";

export interface BandProps {
  id?: string;
  className?: string;
  as?: ElementType;
  children: ReactNode;
  "aria-label"?: string;
}

/** A full-width horizontal band spanning the viewport, with its content centered in a standard container. */
export function Band({ id, className = "", as: Component = "section", children, "aria-label": ariaLabel }: BandProps) {
  const classes = `landing-band ${className}`.trim();
  return (
    <Component id={id} className={classes} aria-label={ariaLabel}>
      <div className="landing-container">
        {children}
      </div>
    </Component>
  );
}
