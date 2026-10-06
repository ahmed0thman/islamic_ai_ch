"use client";

import dynamic from "next/dynamic";
import type { Ui } from "@/lib/types";

// With the flag off (next.config.ts), this branch is dropped at build time, so the static export bundles no Clerk code.
const controls = process.env.NEXT_PUBLIC_HUDA_AUTH === "1" ? {
  UserBadge: dynamic(() => import("./clerk-controls").then((module) => module.UserBadge)),
  SignInEntry: dynamic(() => import("./clerk-controls").then((module) => module.SignInEntry)),
} : null;
export type SignInEntryProps = { ui: Ui; onAct: (action: () => void) => void };
export function UserBadge() { return controls ? <controls.UserBadge /> : null; }
export function SignInEntry(props: SignInEntryProps) { return controls ? <controls.SignInEntry {...props} /> : null; }
