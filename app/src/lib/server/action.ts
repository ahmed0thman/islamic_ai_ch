/** The one wrapper every server action is built with: it resolves the reader, validates the input, and never throws. */
// @ts-expect-error -- Node requires source extensions.
import { currentUserId } from "./auth.ts";
// @ts-expect-error -- Node requires source extensions.
import { toFailure } from "./errors.ts";
// @ts-expect-error -- Node requires source extensions.
import { fail, ok } from "./result.ts";
import type { Result } from "./result";
import type { Validator } from "./validate";

export interface ActionContext { userId: string | null }

export interface ActionConfig<I, O> {
  auth: "optional" | "required";
  input?: Validator<I>;
  handler: (ctx: ActionContext, input: I) => Promise<O>;
}

type AuthResolver = () => Promise<string | null>;

let resolveUser: AuthResolver = currentUserId;

/** Tests replace the Clerk resolver with a fixed answer instead of mocking the module. */
export function setAuthResolver(resolver: AuthResolver): void {
  resolveUser = resolver;
}

export function createAction<I, O>(config: ActionConfig<I, O>): (raw: unknown) => Promise<Result<O>> {
  return async (raw) => {
    try {
      const userId = await resolveUser();
      if (config.auth === "required" && userId === null) return fail("auth_required");
      const input = (config.input ? config.input(raw) : undefined) as I;
      return ok(await config.handler({ userId }, input));
    } catch (error) {
      const failure = toFailure(error);
      return fail(failure.code, failure.message);
    }
  };
}
