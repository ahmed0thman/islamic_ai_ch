import { HugeiconsIcon } from "@hugeicons/react";
import type { ComponentProps } from "react";

export type IconProps = Omit<ComponentProps<typeof HugeiconsIcon>, "size" | "strokeWidth"> & {
  size?: 16 | 20 | 24;
};
export function Icon({ size = 20, ...props }: IconProps) {
  return <HugeiconsIcon aria-hidden="true" focusable="false" {...props} size={size} strokeWidth={1.75} />;
}
