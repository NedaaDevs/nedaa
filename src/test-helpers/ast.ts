import ts from "typescript";

/** A `.tsx` file's syntax tree, with parent links. */
export const parseTsx = (text: string) =>
  ts.createSourceFile("source.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

/** Every node in a file's syntax tree. */
export const nodesOf = (file: ts.SourceFile) => {
  const nodes: ts.Node[] = [];
  const visit = (node: ts.Node) => {
    nodes.push(node);
    ts.forEachChild(node, visit);
  };
  visit(file);
  return nodes;
};
