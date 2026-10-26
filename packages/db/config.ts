/** Every table of this app is `${PREFIX}_<name>`, so the database can be shared with other apps. */
export const PREFIX = "rec";
export const MIGRATIONS_TABLE = `${PREFIX}_migrations`;

/** What the database calls this app's table `name`: `reviews` is `rec_reviews`. */
export const named = (name: string): string => `${PREFIX}_${name}`;
