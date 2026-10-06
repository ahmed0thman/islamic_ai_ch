/** The one wrapper every route handler is built with: the same error mapping as the actions, as a JSON body. */
// @ts-expect-error -- Node requires source extensions.
import { PayloadTooLargeError, ValidationError, toFailure } from "./errors.ts";

const decoder = new TextEncoder();

export function createRoute(handler: (request: Request) => Promise<Response>): (request: Request) => Promise<Response> {
  return async (request) => {
    try {
      return await handler(request);
    } catch (error) {
      const failure = toFailure(error);
      return Response.json(
        { error: { code: failure.code, ...(failure.message === undefined ? {} : { message: failure.message }) } },
        { status: failure.status, headers: { "Cache-Control": "no-store" } },
      );
    }
  };
}

/** Reads a JSON body within a byte limit; too large or unparsable input is a typed error, not a crash. */
export async function readJson(request: Request, maxBytes = 8 * 1024): Promise<unknown> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > maxBytes) throw new PayloadTooLargeError();
  let text: string;
  try { text = await request.text(); } catch { throw new ValidationError("unreadable body"); }
  if (decoder.encode(text).length > maxBytes) throw new PayloadTooLargeError();
  try { return JSON.parse(text); } catch { throw new ValidationError("unparsable JSON body"); }
}
