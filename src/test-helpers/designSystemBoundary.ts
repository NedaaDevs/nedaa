import ts from "typescript";

/**
 * Counts, in one file, the ways a screen reaches past `src/components/ui`. Read from
 * the TypeScript syntax tree, so a comment, a string or a type never counts.
 * Outside `__tests__` because jest collects every file there as a suite.
 */

export type BoundaryVocabulary = {
  /** Every prop name that sets a corner radius, shorthands included. */
  radiusProps: ReadonlySet<string>;
  /** The named radius tokens a screen may use, `$`-prefixed. */
  namedRadii: ReadonlySet<string>;
  /** Every prop name that takes the size scale: width, height and their bounds. */
  sizeProps: ReadonlySet<string>;
};

export type BoundaryCounts = {
  /** The file imports at least one value, not only types, from Tamagui. */
  importsTamaguiValue: boolean;
  useThemeCalls: number;
  /** Radius props whose value is not provably one of the named tokens. */
  rawRadius: number;
  /** Size props given a non-zero number literal. */
  rawSize: number;
  styledCalls: number;
};

const isTamaguiModule = (specifier: string) =>
  specifier === "tamagui" || specifier.startsWith("@tamagui/");

/** The literal ends of a value: both arms of a ternary or a fallback, unwrapped. */
const leaves = (node: ts.Expression): ts.Expression[] => {
  if (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isNonNullExpression(node)
  ) {
    return leaves(node.expression);
  }
  if (ts.isConditionalExpression(node))
    return [...leaves(node.whenTrue), ...leaves(node.whenFalse)];
  if (
    ts.isBinaryExpression(node) &&
    (node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken ||
      node.operatorToken.kind === ts.SyntaxKind.BarBarToken)
  ) {
    return [...leaves(node.left), ...leaves(node.right)];
  }
  return [node];
};

const isNonZeroNumber = (node: ts.Expression): boolean => {
  if (ts.isNumericLiteral(node)) return Number(node.text) !== 0;
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken) {
    return isNonZeroNumber(node.operand);
  }
  return false;
};

/** A JSX attribute's value as an expression, or undefined for a bare `prop`. */
const attributeValue = (attribute: ts.JsxAttribute): ts.Expression | undefined => {
  const init = attribute.initializer;
  if (!init) return undefined;
  if (ts.isStringLiteral(init)) return init;
  if (ts.isJsxExpression(init)) return init.expression;
  return undefined;
};

const propName = (name: ts.Node): string | undefined =>
  ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : undefined;

const THEME_COLOR_MODULE = "@/components/ui/theme-color";

export const countBoundary = (
  fileName: string,
  source: string,
  vocabulary: BoundaryVocabulary
): BoundaryCounts => {
  const file = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );

  // Local name → the name Tamagui exports it under, for value imports only.
  const tamaguiValues = new Map<string, string>();
  let importsTamaguiValue = false;
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier))
      continue;
    // The app's useTheme wraps Tamagui's; a call to it is still a theme read.
    if (statement.moduleSpecifier.text === THEME_COLOR_MODULE) {
      const bindings = statement.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) {
          const imported = (element.propertyName ?? element.name).text;
          if (imported === "useTheme") tamaguiValues.set(element.name.text, imported);
        }
      }
      continue;
    }
    if (!isTamaguiModule(statement.moduleSpecifier.text)) continue;
    const clause = statement.importClause;
    if (!clause) {
      importsTamaguiValue = true;
      continue;
    }
    if (clause.phaseModifier === ts.SyntaxKind.TypeKeyword) continue;
    if (clause.name) importsTamaguiValue = true;
    const bindings = clause.namedBindings;
    if (bindings && ts.isNamespaceImport(bindings)) importsTamaguiValue = true;
    if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        if (element.isTypeOnly) continue;
        importsTamaguiValue = true;
        tamaguiValues.set(element.name.text, (element.propertyName ?? element.name).text);
      }
    }
  }

  const counts: BoundaryCounts = {
    importsTamaguiValue,
    useThemeCalls: 0,
    rawRadius: 0,
    rawSize: 0,
    styledCalls: 0,
  };

  const tally = (name: string | undefined, value: ts.Expression | undefined) => {
    if (!name) return;
    if (vocabulary.radiusProps.has(name)) {
      const named =
        value !== undefined &&
        leaves(value).every(
          (leaf) => ts.isStringLiteralLike(leaf) && vocabulary.namedRadii.has(leaf.text)
        );
      if (!named) counts.rawRadius += 1;
    }
    if (vocabulary.sizeProps.has(name) && value && leaves(value).some(isNonZeroNumber)) {
      counts.rawSize += 1;
    }
  };

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const imported = tamaguiValues.get(node.expression.text);
      if (imported === "useTheme") counts.useThemeCalls += 1;
      if (imported === "styled") counts.styledCalls += 1;
    }
    if (ts.isJsxAttribute(node)) tally(propName(node.name), attributeValue(node));
    if (ts.isPropertyAssignment(node) && ts.isObjectLiteralExpression(node.parent)) {
      tally(propName(node.name), node.initializer);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);

  return counts;
};
