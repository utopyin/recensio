import type { Visitor } from "./types.ts";

type Source = Parameters<NonNullable<Visitor["ImportDeclaration"]>>[0]["source"];

/** Every static, re-exporting, dynamic and type-position specifier in a file. */
export const onSpecifier = (handle: (specifier: string, node: Source) => void): Visitor => {
  const visit = (source: unknown) => {
    const literal = source as Source | null | undefined;
    if (literal?.type === "Literal" && typeof literal.value === "string")
      handle(literal.value, literal);
  };

  return {
    ImportDeclaration: (node) => visit(node.source),
    ExportNamedDeclaration: (node) => visit(node.source),
    ExportAllDeclaration: (node) => visit(node.source),
    ImportExpression: (node) => visit(node.source),
    TSImportType: (node) => visit(node.source),
  };
};
