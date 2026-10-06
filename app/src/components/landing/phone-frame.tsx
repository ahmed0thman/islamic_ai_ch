/** A product screenshot in a quiet CSS bezel. Decorative by contract: the adjacent text carries the meaning, so the frame is hidden from assistive technology and the image has an empty alt. `--frame-w`/`--frame-h` are set by the parent class. */
export function PhoneFrame({ src, eager = false, className }: { src: string; eager?: boolean; className?: string }) {
  const classes = className ? `phone-frame ${className}` : "phone-frame";
  return <span className={classes} aria-hidden="true">
    <img src={src} width={390} height={844} alt="" loading={eager ? "eager" : "lazy"} decoding="async" />
  </span>;
}
