/** The one set of exception classes services and repositories throw, and the one mapping from any thrown value to a failure. */

export type ErrorCode =
  | "validation"
  | "auth_required"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "payload_too_large"
  | "unavailable"
  | "internal";

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly expose: boolean;

  constructor(code: ErrorCode, status: number, message: string, expose = true) {
    super(message);
    this.code = code;
    this.status = status;
    this.expose = expose;
  }
}

export class ValidationError extends AppError {
  constructor(message = "invalid input") { super("validation", 400, message); }
}

export class AuthRequiredError extends AppError {
  constructor(message = "sign in required") { super("auth_required", 401, message); }
}

export class ForbiddenError extends AppError {
  constructor(message = "forbidden") { super("forbidden", 403, message); }
}

export class NotFoundError extends AppError {
  constructor(message = "not found") { super("not_found", 404, message); }
}

export class ConflictError extends AppError {
  constructor(message = "conflict") { super("conflict", 409, message); }
}

export class PayloadTooLargeError extends AppError {
  constructor(message = "payload too large") { super("payload_too_large", 413, message); }
}

export class UnavailableError extends AppError {
  constructor(message = "unavailable") { super("unavailable", 503, message); }
}

export interface Failure { code: ErrorCode; status: number; message?: string }

/**
 * Typed errors keep their code and message; anything else is an internal fault, logged once with name and stack only
 * (never user ids, question text, keys or request bodies).
 */
export function toFailure(error: unknown): Failure {
  if (error instanceof AppError) {
    return { code: error.code, status: error.status, ...(error.expose ? { message: error.message } : {}) };
  }
  if (error instanceof Error) console.error(`${error.name}: ${error.stack ?? ""}`);
  else console.error(`a non-error value was thrown: ${typeof error}`);
  return { code: "internal", status: 500 };
}
