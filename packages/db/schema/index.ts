/**
 * Every table of this app, one module per domain: `export * from "./<domain>"`.
 * A domain's module may hold several tables. Migrations are generated from
 * here, and `./relations` reads it; nothing else should import it whole.
 */
export {};
