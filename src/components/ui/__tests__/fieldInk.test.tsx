import { screen } from "@testing-library/react-native";
import { Theme } from "tamagui";

import config from "../../../../tamagui.config";
import { Actionsheet, ActionsheetContent } from "@/components/ui/actionsheet";
import { Input } from "@/components/ui/input";
import { SheetInput } from "@/components/ui/sheet-input";
import { AppMode } from "@/enums/app";
import { type FieldInk, fieldInkProblems } from "@/test-helpers/fieldInk";
import { type HostElement, styleOf } from "@/test-helpers/text";
import { renderWithTheme } from "@/test-helpers/theme";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@gorhom/bottom-sheet", () => jest.requireActual("@/test-helpers/bottomSheetMock"));
jest.mock("react-native-safe-area-context", () =>
  jest.requireActual("@/test-helpers/safeAreaMock")
);

const ON_SCREEN = "On a screen";
const IN_SHEET = "In a sheet";
const THEMES = [AppMode.LIGHT, AppMode.DARK] as const;

/** A field's inks and fill, as its host element draws them. */
const inkOf = (field: HostElement): FieldInk => {
  const style = styleOf(field);
  return {
    typed: style?.color,
    placeholder: field.props.placeholderTextColor,
    fill: style?.backgroundColor,
  };
};

/** A field on a screen and a boxed field in a sheet, in one theme. */
const renderFields = async (theme: (typeof THEMES)[number]) => {
  await renderWithTheme(
    <>
      <Theme name={theme}>
        <Input placeholder={ON_SCREEN} />
      </Theme>
      <Actionsheet isOpen>
        <ActionsheetContent>
          <Theme name={theme}>
            <SheetInput variant="boxed" placeholder={IN_SHEET} />
          </Theme>
        </ActionsheetContent>
      </Actionsheet>
    </>
  );
  // The open sheet hides the screen behind it from the screen reader.
  return [ON_SCREEN, IN_SHEET].map((label) =>
    inkOf(screen.getByPlaceholderText(label, { includeHiddenElements: true }))
  );
};

describe.each(THEMES)("text fields in the %s theme", (theme) => {
  const tokens = config.themes[theme];

  it("keep typed text above the placeholder, which clears AA", async () => {
    const fields = await renderFields(theme);

    expect(fields.map((field) => fieldInkProblems(field, tokens))).toEqual([[], []]);
  });

  it("draw the placeholder in the theme's placeholder colour", async () => {
    const fields = await renderFields(theme);

    expect(fields.map(({ placeholder }) => placeholder)).toEqual([
      tokens.placeholderColor.val,
      tokens.placeholderColor.val,
    ]);
  });

  it("draw one typed ink on a screen and in a sheet", async () => {
    const [onScreen, inSheet] = await renderFields(theme);

    expect(inSheet.typed).toBe(onScreen.typed);
  });
});
