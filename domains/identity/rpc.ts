/**
 * What a signed-in user may ask about themselves.
 *
 * LEAF MODULE: imports only leaf types and `effect`.
 */
import * as Rpc from "effect/rpc/Rpc";
import * as RpcGroup from "effect/rpc/RpcGroup";
import { Authenticated } from "./access";
import { User } from "./types";

export const IdentityRpcs = RpcGroup.make(
  /** Who the session that makes the call belongs to. */
  Rpc.make("identity.me", { success: User }),
).middleware(Authenticated);
