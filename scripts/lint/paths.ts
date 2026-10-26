import { relative, resolve, sep } from "node:path";

export const ROOT = resolve(import.meta.dirname, "../..");

/** `filename` relative to the repository root, with `/` separators. */
export const repoPath = (filename: string) => relative(ROOT, filename).split(sep).join("/");
