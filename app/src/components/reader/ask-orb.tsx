import { forwardRef } from "react";

export const AskOrb = forwardRef<HTMLSpanElement, { size: "sm" | "lg"; state: "idle" | "listening" | "thinking" }>(
  ({ size, state }, ref) => (
    <span ref={ref} className="ask-orb" data-size={size} data-state={state} aria-hidden="true">
      <span className="ask-orb-sphere">
        <span className="ask-orb-light" data-layer="a" />
        <span className="ask-orb-light" data-layer="b" />
        <span className="ask-orb-shade" />
        <span className="ask-orb-gloss" />
      </span>
    </span>
  )
);
