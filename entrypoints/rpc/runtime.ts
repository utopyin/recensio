import type * as Alchemy from "alchemy";
import type * as Effect from "effect/Effect";

/**
 * A handler's requirements become requirements of the layer that builds the
 * handlers, but `Alchemy.RuntimeContext` is the worker's per-request context:
 * the fiber that serves a call always carries it. Erased from the type, found
 * at runtime.
 */
export const ambient = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, Exclude<R, Alchemy.RuntimeContext>> =>
  effect as unknown as Effect.Effect<A, E, Exclude<R, Alchemy.RuntimeContext>>;
