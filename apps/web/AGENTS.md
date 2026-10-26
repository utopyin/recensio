# Website

TanStack Start on Cloudflare. Everything the browser calls is same-origin: `src/routes/api/$.ts` forwards `/api/*` to the API worker.

## Talking to the API

`src/rpc.ts` is the only client. `Api` is an `AtomRpc.Service` typed from `@recensio/rpc/contract`, so a call the API does not serve is a type error.

- **Read** with `Api.query(tag, payload)`: an atom. Declare it at module level, or in an `Atom.family` keyed by its payload, never inside a component.
- **Write** with `Api.mutation(tag)`, run through `useAtomSet(atom, { mode: "promise" })`. A write names the `reactivityKeys` of the queries it changes, and those load again.
- Errors arrive as the tagged classes the server failed with. Branch on `_tag`.

While a page renders on the server the client never builds: queries stay `Initial` until the browser takes over. Data a page needs before its first paint goes through a route `loader`.

## Client state

**State that outlives one component is an atom** (`effect/reactivity/Atom`), read and written with the `@effect/atom-react` hooks (`useAtomValue`, `useAtomSet`, `useAtom`). One registry serves the whole app (`RegistryProvider` in `src/routes/__root.tsx`); on the server, one per request.

- Put an atom next to what it is about (`src/theme.tsx` holds `dark`), not in a central store file.
- Derive with `Atom.make((get) => ...)` instead of copying state into another atom with an effect.
- `Atom.keepAlive` for state that must survive no one reading it (a preference, a session); leave it off for anything that may be dropped and recomputed.
- The URL stays the source of truth for what it holds (path params, search). When an atom needs it, mirror it in with `useAtomSet` in a layout effect; never the other way round.

**No prop drilling.** A component reads the atom it needs itself. Props carry what a parent decides for this one child (a label, an id, a callback for _its_ event), not state passed through on its way to a grandchild.

**No React Context for state.** `createContext` and `useContext` are refused by the linter in this app. The rare legitimate case is a library's provider (the atom registry, a UI kit's tooltip provider): use theirs, and when one of ours is truly unavoidable, disable the rule on that line with the reason next to it.

`useState` stays the right tool for state no other component reads: an input's text, whether a menu is open.
