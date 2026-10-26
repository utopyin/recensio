import { MIGRATIONS_TABLE, PREFIX } from "./config";
import { defineConfig } from "drizzle-kit";

const url = process.env.DATABASE_URL ?? "";

export default defineConfig({
  dialect: "postgresql",
  schema: "./schema/index.ts",
  out: "./migrations",
  tablesFilter: [`${PREFIX}_*`],
  migrations: { table: MIGRATIONS_TABLE, schema: "public" },
  dbCredentials: { url },
  verbose: true,
});
