import { z } from "zod";

// Shared building blocks for all record schemas.

export const LIMITS = {
  name: 120,
  shortText: 500,
  longText: 4000,
  listItems: 100,
  label: 120,
} as const;

export const idSchema = z.string().min(1).max(64);
export const timestampSchema = z.iso.datetime();

export const nameSchema = z.string().trim().min(1).max(LIMITS.name);
export const shortTextSchema = z.string().max(LIMITS.shortText);
export const longTextSchema = z.string().max(LIMITS.longText);
export const textListSchema = z.array(shortTextSchema).max(LIMITS.listItems);
export const idListSchema = z.array(idSchema).max(LIMITS.listItems);

/** Dependencies injected into domain constructors so they stay pure and testable. */
export interface DomainDeps {
  now?: () => Date;
  newId?: () => string;
}

export function resolveNow(deps?: DomainDeps): string {
  return (deps?.now ? deps.now() : new Date()).toISOString();
}

// Web Crypto is a global in every supported runtime (Node >= 20 and browsers).
// Declared locally so the domain stays free of platform type dependencies.
declare const crypto: { randomUUID(): string };

export function resolveId(deps?: DomainDeps): string {
  return deps?.newId ? deps.newId() : crypto.randomUUID();
}

/**
 * Copy of `obj` without keys whose value is `undefined`, so partial updates
 * can be spread over an entity without erasing existing fields
 * (required under exactOptionalPropertyTypes).
 */
export function definedProps<T extends object>(
  obj: T,
): { [K in keyof T]?: Exclude<T[K], undefined> } {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined)) as {
    [K in keyof T]?: Exclude<T[K], undefined>;
  };
}
