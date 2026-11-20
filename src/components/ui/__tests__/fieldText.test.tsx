import type { ReactElement } from "react";
import { screen } from "@testing-library/react-native";
import { getTokenValue } from "tamagui";

import { Actionsheet, ActionsheetContent } from "@/components/ui/actionsheet";
import { INPUT_SIZE, Input, type InputSize } from "@/components/ui/input";
import { SearchField } from "@/components/ui/search-field";
import { SHEET_INPUT_TEXT, SheetInput } from "@/components/ui/sheet-input";
import { Text } from "@/components/ui/text";
import { TEXT_SIZE_MULTIPLIERS } from "@/constants/TextSize";
import { TextScaleContext } from "@/hooks/useTextScale";
import { type HostElement, lineRoomOf, styleOf } from "@/test-helpers/text";
import { renderWithTheme } from "@/test-helpers/theme";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@gorhom/bottom-sheet", () => jest.requireActual("@/test-helpers/bottomSheetMock"));
jest.mock("react-native-safe-area-context", () =>
  jest.requireActual("@/test-helpers/safeAreaMock")
);

const FIELD = "Field";
const SAMPLE = "Sample";
const CALLER_FONT = 32;

const STEPS = Object.values(TEXT_SIZE_MULTIPLIERS);
const SIZES = Object.keys(INPUT_SIZE) as InputSize[];

const onScreen = (ui: ReactElement) => ui;
const inSheet = (ui: ReactElement) => (
  <Actionsheet isOpen>
    <ActionsheetContent>{ui}</ActionsheetContent>
  </Actionsheet>
);
// Each place with the floor its field sets: Input's, or none for SheetInput.
const PLACES = [
  ["on a screen", onScreen, () => getTokenValue(INPUT_SIZE.md.minHeight, "size")],
  ["in a sheet", inSheet, () => undefined],
] as const;

const search = <SearchField value="" onChangeText={() => {}} placeholder={FIELD} />;

/** A field and a Text line on one surface and text scale, as host elements. */
const renderPair = async (
  m: number,
  field: ReactElement,
  line: ReactElement,
  place: (ui: ReactElement) => ReactElement = onScreen
) => {
  await renderWithTheme(
    <TextScaleContext value={m}>
      {place(
        <>
          {field}
          {line}
        </>
      )}
    </TextScaleContext>
  );
  return { field: screen.getByPlaceholderText(FIELD), line: screen.getByText(SAMPLE) };
};

const fontOf = (element: HostElement) => styleOf(element)?.fontSize;
const faceOf = (element: HostElement) => styleOf(element)?.fontFamily;
const lineOf = (element: HostElement) => Number(styleOf(element)?.lineHeight);

describe.each(STEPS)("at text scale %s", (m) => {
  it.each(SIZES)("the %s Input sets its text as Text does", async (size) => {
    const { field, line } = await renderPair(
      m,
      <Input size={size} placeholder={FIELD} />,
      <Text size={INPUT_SIZE[size].text}>{SAMPLE}</Text>
    );

    expect(fontOf(field)).toBe(fontOf(line));
    expect(faceOf(field)).toBe(faceOf(line));
  });

  it("a multiline Input sets its text as Text does", async () => {
    const { field, line } = await renderPair(
      m,
      <Input multiline placeholder={FIELD} />,
      <Text size={INPUT_SIZE.md.text}>{SAMPLE}</Text>
    );

    expect(fontOf(field)).toBe(fontOf(line));
    expect(faceOf(field)).toBe(faceOf(line));
  });

  it("an Input scales a caller's font size as Text does", async () => {
    const { field, line } = await renderPair(
      m,
      <Input fontSize={CALLER_FONT} placeholder={FIELD} />,
      <Text fontSize={CALLER_FONT}>{SAMPLE}</Text>
    );

    expect(fontOf(field)).toBe(fontOf(line));
  });

  it.each(PLACES)(
    "the search pill %s sets its text as the md Input",
    async (_place, place, floor) => {
      const { field, line } = await renderPair(
        m,
        search,
        <Text size={INPUT_SIZE.md.text}>{SAMPLE}</Text>,
        place
      );

      expect(styleOf(field)?.minHeight).toBe(floor());
      expect(fontOf(field)).toBe(fontOf(line));
      expect(lineRoomOf(field)).toBeGreaterThanOrEqual(lineOf(line));
    }
  );

  it("a SheetInput sets its own text as Text does", async () => {
    const { field, line } = await renderPair(
      m,
      <SheetInput placeholder={FIELD} />,
      <Text size={SHEET_INPUT_TEXT}>{SAMPLE}</Text>,
      inSheet
    );

    expect(fontOf(field)).toBe(fontOf(line));
  });

  it("a SheetInput scales a caller's font size as Text does", async () => {
    const { field, line } = await renderPair(
      m,
      <SheetInput placeholder={FIELD} style={{ fontSize: CALLER_FONT }} />,
      <Text fontSize={CALLER_FONT}>{SAMPLE}</Text>,
      inSheet
    );

    expect(fontOf(field)).toBe(fontOf(line));
  });
});

// A pinned height clips a scaled line; unset padding takes Android's inset.
describe("the Input box", () => {
  it.each(SIZES)("the single-line %s Input grows with its line", async (size) => {
    await renderWithTheme(<Input size={size} placeholder={FIELD} />);
    const style = styleOf(screen.getByPlaceholderText(FIELD));

    expect(style?.height).toBe("auto");
    expect(style?.paddingTop).toBe(0);
    expect(style?.paddingBottom).toBe(0);
  });

  it("a multiline Input keeps padding around its text", async () => {
    await renderWithTheme(<Input multiline placeholder={FIELD} />);
    const style = styleOf(screen.getByPlaceholderText(FIELD));

    expect(style?.height).toBe("auto");
    expect(Number(style?.paddingTop)).toBeGreaterThan(0);
    expect(Number(style?.paddingBottom)).toBeGreaterThan(0);
  });
});

// The app text size replaces the OS font scale, so the two never stack.
describe("text fields and the OS font scale", () => {
  it.each([
    ["an Input", <Input key="input" placeholder={FIELD} />],
    // @ts-expect-error a field takes no font scaling from its caller
    ["an Input asked to scale", <Input key="input" allowFontScaling placeholder={FIELD} />],
    ["a search pill", search],
    ["a search pill in a sheet", inSheet(search)],
    ["a SheetInput", inSheet(<SheetInput placeholder={FIELD} />)],
    // @ts-expect-error a field takes no font scaling from its caller
    ["a SheetInput asked to scale", inSheet(<SheetInput allowFontScaling placeholder={FIELD} />)],
  ])("%s ignores it", async (_field, ui) => {
    await renderWithTheme(ui);

    expect(screen.getByPlaceholderText(FIELD).props.allowFontScaling).toBe(false);
  });
});
