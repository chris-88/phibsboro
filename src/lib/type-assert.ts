/**
 * Compile-time identity checks, used by every entity schema to prove its inferred type is the
 * generated row type and nothing else (S1.5 AC2, AC3). Zero runtime; a mismatch is a
 * `typecheck` failure at the assertion's line.
 *
 * `Equal` compares by identity rather than mutual assignability, so `string` vs `'a' | 'b'`
 * and `T | null` vs `T` both fail, which is exactly what an enum or nullability drift looks like.
 */
// The unused-looking type parameter is the whole mechanism: two generic signatures are
// "identical" to the checker only when A and B are, which is stricter than assignability.
/* eslint-disable @typescript-eslint/no-unnecessary-type-parameters */
export type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
/* eslint-enable @typescript-eslint/no-unnecessary-type-parameters */

export type Expect<T extends true> = T
