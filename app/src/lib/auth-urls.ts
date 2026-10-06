/**
 * Where Clerk sends the reader: the app's own sign-in and sign-up pages, and back to the reading after them.
 * The paths belong to the code (the pages live at these routes); the env names only override them. An empty
 * value counts as unset, because a service that declares the name without a value must not blank the path:
 * Clerk would then fall back to its hosted Account Portal.
 */
export const SIGN_IN_PATH = "/sign-in";
export const SIGN_UP_PATH = "/sign-up";
export const AFTER_AUTH_PATH = "/";

/** The env value when it holds something, otherwise the default. */
export function pathOr(env: string | undefined, fallback: string): string {
  return env?.trim() ? env.trim() : fallback;
}

/** The four paths from the given env values. */
export function authUrls(env: { signIn?: string; signUp?: string; signInAfter?: string; signUpAfter?: string }) {
  return {
    signInUrl: pathOr(env.signIn, SIGN_IN_PATH),
    signUpUrl: pathOr(env.signUp, SIGN_UP_PATH),
    signInFallbackRedirectUrl: pathOr(env.signInAfter, AFTER_AUTH_PATH),
    signUpFallbackRedirectUrl: pathOr(env.signUpAfter, AFTER_AUTH_PATH),
  };
}

/** The four paths from the build's env. The reads stay literal, since Next inlines `NEXT_PUBLIC_*` only when it sees the full name. `ClerkProvider` takes them as props, and the two pages take the sibling page's path from them. */
export const envAuthUrls = () => authUrls({
  signIn: process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL,
  signUp: process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL,
  signInAfter: process.env.NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL,
  signUpAfter: process.env.NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL,
});
