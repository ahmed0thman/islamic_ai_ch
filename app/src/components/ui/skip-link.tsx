/** The "skip to the text" link: hidden until it takes focus, shared by the phone and wide reading layouts. */
export function SkipLink({ href, children }: { href: string; children: string }) {
  return <a className="wide-skip" href={href}>{children}</a>;
}
