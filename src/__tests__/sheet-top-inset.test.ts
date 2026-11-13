import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import type * as Gorhom from "@gorhom/bottom-sheet";

import type * as SheetChrome from "@/components/ui/sheet-chrome";
import { nodesOf, parseTsx } from "@/test-helpers/ast";
import { appSourceFiles, REPO_ROOT } from "@/test-helpers/routeTree";

/** gorhom's modal sheet, by its JSX name. */
const MODAL: keyof typeof Gorhom = "BottomSheetModal";

/** The prop that stops a sheet's climb, with the keyboard up or a tall body. */
const TOP_INSET: keyof Gorhom.BottomSheetModalProps = "topInset";

/** The hook that holds a sheet below the status bar. */
const TOP_INSET_HOOK: keyof typeof SheetChrome = "useSheetTopInset";

/** The Quran reader's tree, outside this rule. */
const QURAN_READER = "src/components/quran/";

/** Whether each gorhom modal takes its top inset from the hook. */
const readSheets = (text: string) => {
  const file = parseTsx(text);
  const nodes = nodesOf(file);
  const isHookCall = (node?: ts.Node) =>
    node !== undefined &&
    ts.isCallExpression(node) &&
    node.expression.getText(file) === TOP_INSET_HOOK;
  const hookNames = nodes
    .filter(ts.isVariableDeclaration)
    .filter((declaration) => isHookCall(declaration.initializer))
    .map((declaration) => declaration.name.getText(file));
  const fromHook = ({ initializer }: ts.JsxAttribute) =>
    initializer !== undefined &&
    ts.isJsxExpression(initializer) &&
    initializer.expression !== undefined &&
    hookNames.includes(initializer.expression.getText(file));
  return nodes
    .filter(ts.isJsxOpeningLikeElement)
    .filter((element) => element.tagName.getText(file) === MODAL)
    .map((element) =>
      element.attributes.properties
        .filter(ts.isJsxAttribute)
        .some((prop) => prop.name.getText(file) === TOP_INSET && fromHook(prop))
    );
};

/** The app's files that draw a gorhom modal, from the repo root. */
const SHEETS = appSourceFiles()
  .filter((path) => path.endsWith(".tsx") && !path.startsWith(QURAN_READER))
  .map((path) => [path, readSheets(readFileSync(join(REPO_ROOT, path), "utf8"))] as const)
  .filter(([, modals]) => modals.length > 0);

describe("sheet top inset rule", () => {
  it.each([
    ["const topInset = useSheetTopInset(); <BottomSheetModal topInset={topInset} />", [true]],
    ["const topInset = insets.top; <BottomSheetModal topInset={topInset} />", [false]],
    [
      "const topInset = useSheetTopInset(); <><BottomSheetModal topInset={topInset} /><BottomSheetModal topInset={0} /></>",
      [true, false],
    ],
    ["<BottomSheetModal ref={ref}>{body}</BottomSheetModal>", [false]],
    ["const ref = useRef<BottomSheetModal>(null);", []],
  ])("reads %s", (text, modals) => {
    expect(readSheets(text)).toEqual(modals);
  });
});

// The keyboard lifts a sheet no higher than its top inset.
describe("sheet top inset", () => {
  it("finds the app's sheets", () => {
    expect(SHEETS.length).toBeGreaterThan(2);
  });

  it.each(SHEETS)("%s takes each sheet's top inset from the hook", (_path, modals) => {
    expect(modals).not.toContain(false);
  });
});
