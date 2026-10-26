import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Docker from "@alchemy.run/docker";
import { resolvePoolConfig } from "@alchemy.run/sql/PostgresTls";
import * as PgClient from "@effect/sql-pg/PgClient";
import * as Alchemy from "alchemy";
import * as Command from "alchemy/Command";
import type * as Output from "alchemy/Output";
import { makeExecutionMemo } from "alchemy/Runtime/ExecutionMemo";
import { proxyChain } from "alchemy/Util/proxy-chain";
import * as PgDrizzle from "drizzle-orm/effect-postgres";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Client from "./client";
import { relations } from "./schema/relations";
import { type Instance, Service } from "./service";

/** Local Postgres for `alchemy dev`. */
export const LOCAL = {
  user: "recensio",
  password: "recensio",
  database: "recensio",
  port: 54340,
} as const;
const PG_IMAGE_TAG = "18";

const placeholder = {
  name: "recensio",
  origin: {
    scheme: "postgres" as const,
    host: "runtime",
    port: 5432,
    database: "runtime",
    user: "runtime",
    password: Redacted.make(""),
  },
};

/*
 * What only the stack reads is a function, from here to `production`: each is
 * called past the runtime check in `Hyperdrive` and nowhere else, so the
 * worker's bundle holds none of it. A value would be built when the module
 * loads, and the bundler would have to keep it.
 */

const localUrl = () =>
  `postgres://${LOCAL.user}:${LOCAL.password}@localhost:${LOCAL.port}/${LOCAL.database}`;

const local = () =>
  Effect.gen(function* () {
    const image = yield* Docker.RemoteImage("DbImage", { name: "postgres", tag: PG_IMAGE_TAG });
    return yield* Docker.Container("DbLocal", {
      name: "recensio-postgres",
      image,
      environment: {
        POSTGRES_DB: LOCAL.database,
        POSTGRES_USER: LOCAL.user,
        POSTGRES_PASSWORD: LOCAL.password,
      },
      ports: [{ external: LOCAL.port, internal: 5432 }],
      // Explicit: alchemy disconnects every network it was not told about on
      // update, bridge included, which silently drops the published port.
      networks: [{ name: "bridge" }],
      // Named volume; the postgres:18 image wants the mount at /var/lib/postgresql, not /data.
      volumes: [{ hostPath: "recensio-postgres-data", containerPath: "/var/lib/postgresql" }],
      start: true,
      // The container outlives a stack's state: another checkout, or a state store
      // that moved, finds it already there. It is ours by name, so take it.
    }).pipe(Alchemy.AdoptPolicy.adopt(true));
  });

/**
 * `bun run migrate` in this package; it retries until the database accepts
 * connections. `after` is an output of the database resource: alchemy orders
 * by output references, so this is what makes the Exec wait for it. The path
 * is relative to the repo root, where alchemy runs.
 */
const migrate = (url: string, after: string | Output.Output<string>) =>
  Command.Exec("DbMigrate", {
    command: "bun run migrate",
    cwd: "packages/db",
    env: { DATABASE_URL: Redacted.make(url), DB_RESOURCE: after },
    memo: { include: ["migrations/**"] },
  });

/**
 * Drizzle Studio on the local database, for as long as `alchemy dev` runs. A
 * `Command.Dev` only exists in dev: a deploy does not start it. Its page is
 * https://local.drizzle.studio, which talks to the server started here.
 */
// @effect-diagnostics-next-line lazyEffect:off -- a function, like the rest of what only the stack reads: a value would stay in the worker bundle
export const Studio = () =>
  Command.Dev("DbStudio", {
    command: "bun run studio",
    cwd: "packages/db",
    env: { DATABASE_URL: Redacted.make(localUrl()) },
  });

/**
 * Runtime traffic (Hyperdrive) uses a data-only app role; migrations use a
 * separate owner URL, since DDL needs rights the app role must not have.
 */
const production = () =>
  Effect.gen(function* () {
    const origin = {
      scheme: "postgres" as const,
      host: yield* Config.String("DB_HOST"),
      port: yield* Config.Number("DB_PORT").pipe(Config.withDefault(5432)),
      database: yield* Config.String("DB_NAME"),
      user: yield* Config.String("DB_USER"),
      password: yield* Config.Redacted("DB_PASSWORD"),
    };
    const migrateUrl = Redacted.value(yield* Config.Redacted("DB_MIGRATE_URL"));
    return { origin, migrateUrl };
  });

/**
 * The Hyperdrive in front of Postgres. In dev the worker talks to the Docker
 * Postgres instead; migrations run in both cases.
 */
export const Hyperdrive = Cloudflare.Hyperdrive.Connection(
  "Db",
  Effect.gen(function* () {
    // The props Effect also runs inside the worker (`Hyperdrive.Connect` re-evaluates
    // the resource). There the binding is what matters; the bundler folds this flag
    // to `true`, so everything below it stays out of the worker bundle.
    if (globalThis.__ALCHEMY_RUNTIME__) return placeholder;
    const name = yield* Config.String("HYPERDRIVE_NAME").pipe(Config.withDefault("recensio"));
    const dev = yield* Alchemy.ALCHEMY_DEV;
    if (dev) {
      const container = yield* local();
      yield* migrate(localUrl(), container.id);
      const origin = {
        scheme: "postgres" as const,
        host: "localhost",
        port: LOCAL.port,
        database: LOCAL.database,
        user: LOCAL.user,
        password: Redacted.make(LOCAL.password),
      };
      return { name, origin, dev: { ...origin, sslmode: "disable" as const } };
    }
    const { origin, migrateUrl } = yield* production();
    yield* migrate(migrateUrl, origin.host);
    return { name, origin, caching: { disabled: true } };
  }).pipe(Effect.orDie),
).pipe(Alchemy.RemovalPolicy.retain());

/**
 * `Database.Service` over that Hyperdrive, and `Client.Service` for the
 * Postgres client under it, for any worker that provides them: building the
 * layer binds the Hyperdrive to the worker.
 *
 * The pool is opened on the first query of a request and closed with it: a
 * workerd socket belongs to one request. Hyperdrive pools in transaction
 * mode, so named prepared statements are off.
 *
 * This is `Drizzle.Postgres` of `@alchemy.run/drizzle`, rebuilt from the same
 * alchemy helpers because that one keeps the client to itself, and auth has
 * to be handed it. The helpers are reached through alchemy's wildcard export,
 * not a documented entry point: re-check these imports when alchemy moves.
 */
export const layer = Layer.effectContext(
  Effect.gen(function* () {
    const connection = yield* Cloudflare.Hyperdrive.Connect(yield* Hyperdrive);
    const open = yield* makeExecutionMemo(
      Effect.gen(function* () {
        const url = yield* connection.connectionString;
        const context = yield* Layer.build(
          PgClient.layer(resolvePoolConfig(url, { prepare: false })),
        );
        const db = yield* PgDrizzle.makeWithDefaults({ relations }).pipe(
          Effect.provideContext(context),
        );
        return { client: Context.get(context, PgClient.PgClient), db };
      }).pipe(Effect.orDie),
    );

    // Each query resolves the request's pool when it runs, so services built
    // once per isolate can hold this instance.
    const database = proxyChain(Effect.map(open, ({ db }) => db)) as unknown as Instance;
    // The execution scope every worker event carries is erased, as alchemy does.
    // oxlint-disable-next-line effecttsgo/unsafe-effect-type-assertion
    const client = Effect.map(open, (opened) => opened.client) as Client.Service["Service"];

    return Context.make(Service, database).pipe(Context.add(Client.Service, client));
  }),
).pipe(Layer.provide(Cloudflare.Hyperdrive.ConnectBinding));
