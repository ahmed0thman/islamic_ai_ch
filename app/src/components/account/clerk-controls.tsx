"use client";

import { Show, UserButton, useClerk } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import type { SignInEntryProps } from "./account";
import "./clerk.css";

/** The signed-in reader's avatar. It sits in the app bar and not in the drawer: Clerk's menu opens in a portal, and a modal dialog blocks pointer events outside itself. */
export function UserBadge() {
  return <Show when="signed-in"><UserButton /></Show>;
}
/** Sign-in and sign-up at the foot of the drawer. `onAct` closes the drawer first, so its history entry is gone before Clerk's page opens. */
export function SignInEntry({ ui, onAct }: SignInEntryProps) {
  const clerk = useClerk();
  return <Show when="signed-out"><div className="menu-account">
    <Button variant="pill" onClick={() => onAct(() => void clerk.redirectToSignIn())}>{ui.account.sign_in}</Button>
    <Button variant="quiet" onClick={() => onAct(() => void clerk.redirectToSignUp())}>{ui.account.sign_up}</Button>
  </div></Show>;
}
