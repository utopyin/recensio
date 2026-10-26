import { pgTableCreator } from "drizzle-orm/pg-core";
import { named } from "./config";

/** The only table factory a domain's schema may use: `table("reviews")` → `rec_reviews`, snake_case columns. */
export const table = pgTableCreator(named, "snake_case");
