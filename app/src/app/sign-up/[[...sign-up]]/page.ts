import { createElement } from "react";
import { notFound } from "next/navigation";
import { SignUp } from "@clerk/nextjs";
import { getUi } from "@/lib/content";
import { envAuthUrls } from "@/lib/auth-urls";
import { AuthPage, backHref } from "@/components/account/auth-page";

// A .ts page on purpose: the static export drops .ts pages (next.config.ts), and it has no Clerk.
export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ redirect_url?: string | string[] }> }) {
  if (process.env.NEXT_PUBLIC_HUDA_AUTH !== "1") notFound();
  const [ui, { redirect_url }] = await Promise.all([getUi(), searchParams]);
  return createElement(AuthPage, { ui, back: backHref(redirect_url), children: createElement(SignUp, { signInUrl: envAuthUrls().signInUrl }) });
}
