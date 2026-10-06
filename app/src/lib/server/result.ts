/** The one shape every server action returns: a value, or one typed error. Never an exception across the boundary. */
import type { ErrorCode } from "./errors";

export type Result<T> = { ok: true; data: T } | { ok: false; error: { code: ErrorCode; message?: string } };

export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

export function fail(code: ErrorCode, message?: string): Result<never> {
  return { ok: false, error: { code, ...(message === undefined ? {} : { message }) } };
}
