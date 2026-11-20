import { readFileSync } from "fs";
import { join } from "path";
import { StyleSheet } from "react-native";
import ts from "typescript";
import { screen } from "@testing-library/react-native";

import { OnboardingFrame } from "@/components/onboarding/flow/OnboardingFrame";
import { FRAME_MODE, ONBOARDING_PART } from "@/constants/Onboarding";
import { renderWithTheme } from "@/test-helpers/theme";

const INSETS = { top: 47, right: 0, bottom: 34, left: 0 };

jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  useSafeAreaInsets: () => INSETS,
}));

// React Native's own View, so the patched magic tap flag shows on the host.
jest.mock("react-native/Libraries/Components/View/View", () =>
  jest.requireActual("react-native/Libraries/Components/View/View")
);

const noop = () => {};

// The flow draws on the sky like a sky screen, so it pads both of its edges.
it.each(Object.values(FRAME_MODE))("pads the %s frame by the device insets", async (mode) => {
  await renderWithTheme(
    <OnboardingFrame
      mode={mode}
      progress="1 of 6"
      fraction={0}
      canGoBack={false}
      busy={false}
      showPrimary
      primaryLabel="Continue"
      onPrimary={noop}
      onBack={noop}
      onSkip={noop}>
      {null}
    </OnboardingFrame>
  );

  const style = StyleSheet.flatten(screen.getByTestId(ONBOARDING_PART.FRAME).props.style);
  expect(style).toEqual(
    expect.objectContaining({ paddingTop: INSETS.top, paddingBottom: INSETS.bottom })
  );
});

// Only React Native's View raises the flag that Fabric's iOS view reads.
it("carries a magic tap on React Native's own View", async () => {
  await renderWithTheme(
    <OnboardingFrame
      mode={FRAME_MODE.CHROME}
      progress="1 of 6"
      fraction={0}
      canGoBack={false}
      busy={false}
      showPrimary
      primaryLabel="Continue"
      onPrimary={noop}
      onBack={noop}
      onSkip={noop}
      onMagicTap={noop}>
      {null}
    </OnboardingFrame>
  );

  expect(screen.getByTestId(ONBOARDING_PART.FRAME)).toHaveProp("onAccessibilityMagicTap", true);
});

const FRAME_SOURCE = join(__dirname, "..", "OnboardingFrame.tsx");
const RN = "react-native";
const MAGIC_TAP = "onMagicTap";

/** Each tag that takes `onMagicTap`, and whether react-native supplies it. */
const magicTapHosts = () => {
  const file = ts.createSourceFile(
    FRAME_SOURCE,
    readFileSync(FRAME_SOURCE, "utf8"),
    ts.ScriptTarget.Latest
  );
  const fromRN = new Set<string>();
  const tags: string[] = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.moduleSpecifier.text === RN
    ) {
      const names = node.importClause?.namedBindings;
      if (names && ts.isNamedImports(names)) names.elements.forEach((e) => fromRN.add(e.name.text));
    }
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const takes = node.attributes.properties.some(
        (prop) => ts.isJsxAttribute(prop) && prop.name.getText(file) === MAGIC_TAP
      );
      if (takes) tags.push(node.tagName.getText(file));
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return tags.map((tag) => ({ tag, fromRN: fromRN.has(tag) }));
};

// A Tamagui view can render RCTView directly, past the patched View.js.
it("sets onMagicTap only on a view react-native supplies", () => {
  const hosts = magicTapHosts();

  expect(hosts.length).toBeGreaterThan(0);
  expect(hosts.filter((host) => !host.fromRN)).toEqual([]);
});
