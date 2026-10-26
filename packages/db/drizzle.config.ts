import { MIGRATIONS_TABLE, PREFIX } from "./config";
import { defineConfig } from "drizzle-kit";

/**
 * `DATABASE_URL` when set (`.env`: the local database). Otherwise the
 * deployed database's app role, from the `DB_*` values of `.env.prod`:
 * the role the API uses, which reads and writes data and cannot change the
 * schema. Empty when neither is there: `generate` needs no database.
 */
const deployed = () => {
  const { DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD } = process.env;
  if (!DB_HOST || !DB_NAME || !DB_USER) return "";
  const user = encodeURIComponent(DB_USER);
  const password = encodeURIComponent(DB_PASSWORD ?? "");
  return `postgres://${user}:${password}@${DB_HOST}:${DB_PORT || 5432}/${DB_NAME}?sslmode=verify-full`;
};

const url = process.env.DATABASE_URL || deployed();

export default defineConfig({
  dialect: "postgresql",
  schema: "./schema/index.ts",
  out: "./migrations",
  tablesFilter: [`${PREFIX}_*`],
  migrations: { table: MIGRATIONS_TABLE, schema: "public" },
  dbCredentials: { url },
  verbose: true,
});
