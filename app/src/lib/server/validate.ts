/** The reusable input validators every wrapper builds on: inputs stay `unknown` until validated once, at the boundary. */
// @ts-expect-error -- Node requires source extensions.
import { ValidationError } from "./errors.ts";

export type Validator<T> = (raw: unknown) => T;

export function int({ min, max }: { min: number; max: number }): Validator<number> {
  return (raw) => {
    if (typeof raw !== "number" || !Number.isInteger(raw) || raw < min || raw > max) {
      throw new ValidationError(`expected an integer from ${min} to ${max}`);
    }
    return raw;
  };
}

export function text({ min, max, trim = false }: { min: number; max: number; trim?: boolean }): Validator<string> {
  return (raw) => {
    if (typeof raw !== "string") throw new ValidationError("expected text");
    const value = trim ? raw.trim() : raw;
    const length = [...value].length;
    if (length < min || length > max) throw new ValidationError(`expected text of ${min} to ${max} characters`);
    return value;
  };
}

export function arrayOf<T>(item: Validator<T>, { min = 0, max }: { min?: number; max: number }): Validator<T[]> {
  return (raw) => {
    if (!Array.isArray(raw)) throw new ValidationError("expected an array");
    if (raw.length < min || raw.length > max) throw new ValidationError(`expected an array of ${min} to ${max} items`);
    return raw.map(item);
  };
}

export function nullable<T>(item: Validator<T>): Validator<T | null> {
  return (raw) => (raw === null || raw === undefined ? null : item(raw));
}

export function optional<T>(item: Validator<T>): Validator<T | undefined> {
  return (raw) => (raw === undefined ? undefined : item(raw));
}

export function literal<T extends string>(...values: readonly T[]): Validator<T> {
  return (raw) => {
    if (typeof raw === "string" && (values as readonly string[]).includes(raw)) return raw as T;
    throw new ValidationError(`expected one of: ${values.join(", ")}`);
  };
}

export function object<T>(shape: { [K in keyof T]: Validator<T[K]> }): Validator<T> {
  return (raw) => {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw new ValidationError("expected an object");
    const source = raw as Record<string, unknown>;
    const out = {} as Record<string, unknown>;
    for (const key of Object.keys(shape) as (keyof T & string)[]) out[key] = shape[key](source[key]);
    return out as T;
  };
}
