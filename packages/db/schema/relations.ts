import { defineRelations } from "drizzle-orm";
import * as schema from "./index";

/**
 * Every relation between the tables of `./index`, in one place, so the
 * relational queries of `Database.Service` (`db.query.<table>`) see all of
 * them. A relation across two domains lives here too.
 */
export const relations = defineRelations(schema, () => ({}));
