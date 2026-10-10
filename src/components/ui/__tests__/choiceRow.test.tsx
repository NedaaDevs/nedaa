import { StyleSheet, Text } from "react-native";
import { act, fireEvent, screen, userEvent } from "@testing-library/react-native";
import { FontLanguage } from "tamagui";

import { CHOICE_ROW_PART, ChoiceGroup, ChoiceRow } from "@/components/ui/choice-row";
import { LIST_GROUP_PART } from "@/components/ui/list-group";
import { LIST_ROW_VARIANT } from "@/components/ui/list-row";
import { NEDAA_LIGHT } from "@/constants/Palette";
import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import { controlProblems } from "@/test-helpers/controls";
import { renderWithTheme } from "@/test-helpers/theme";

let mockReduced = false;
jest.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => mockReduced }));

const GROUP = "Appearance";
const OPTIONS = [
  { id: "light", title: "Light", subtitle: "Always bright" },
  { id: "dark", title: "Dark", subtitle: "Always dark" },
] as const;

type Setup = { selected?: string; onPress?: (id: string) => void };

const renderGroup = ({ selected = "light", onPress = jest.fn() }: Setup = {}) =>
  renderWithTheme(
    <ChoiceGroup label={GROUP}>
      {OPTIONS.map(({ id, title, subtitle }) => (
        <ChoiceRow
          key={id}
          title={title}
          subtitle={subtitle}
          selected={selected === id}
          onPress={() => onPress(id)}
          leading={<Text testID={`leading-${id}`}>*</Text>}
        />
      ))}
    </ChoiceGroup>
  );

const rows = () => screen.getAllByRole("radio");
const checks = () => screen.getAllByTestId(CHOICE_ROW_PART.CHECK, { includeHiddenElements: true });
const ticks = () => screen.queryAllByTestId(CHOICE_ROW_PART.TICK, { includeHiddenElements: true });

const styleOf = (row: ReturnType<typeof rows>[number]) => StyleSheet.flatten(row.props.style);

describe("ChoiceRow", () => {
  beforeEach(() => {
    mockReduced = false;
  });

  it("reads each row as a radio in a named group", async () => {
    await renderGroup();

    expect(screen.getByLabelText(GROUP)).toHaveProp("accessibilityRole", "radiogroup");
    expect(rows().map((row) => row.props.accessibilityLabel)).toEqual(
      OPTIONS.map(({ title, subtitle }) => i18n.t("a11y.join", { first: title, second: subtitle }))
    );
  });

  it("marks only the chosen row selected, by state and by its check", async () => {
    await renderGroup({ selected: "dark" });

    expect(rows().map((row) => row.props.accessibilityState?.selected)).toEqual([false, true]);
    expect(checks()).toHaveLength(2);
    expect(ticks()).toHaveLength(1);
  });

  it("reports a press", async () => {
    const onPress = jest.fn();
    await renderGroup({ onPress });

    await userEvent.setup().press(rows()[1]);

    expect(onPress).toHaveBeenCalledWith("dark");
  });

  it("draws what it is given at the start", async () => {
    await renderGroup();

    expect(screen.getByTestId("leading-light")).toBeOnTheScreen();
  });

  it("reads the title alone when there is no subtitle", async () => {
    await renderWithTheme(<ChoiceRow title="العربية" selected={false} onPress={jest.fn()} />);

    expect(rows()[0]).toHaveProp("accessibilityLabel", "العربية");
  });

  it("gives every row a role, a name and a 44pt target", async () => {
    await renderGroup();

    expect(controlProblems()).toEqual([]);
  });

  it("draws its own edge", async () => {
    await renderGroup();

    expect(styleOf(rows()[0]).borderTopWidth).toBe(1);
  });

  // A card under the finger shrinks a touch and keeps its full colour.
  it.each([
    [false, [{ scale: 0.99 }]],
    [true, undefined],
  ] as const)("presses in (Reduce Motion: %s)", async (reduced, transform) => {
    mockReduced = reduced;
    await renderGroup();

    await act(() => fireEvent(rows()[0], "responderGrant", { nativeEvent: {} }));

    expect(styleOf(rows()[0])).toMatchObject({ opacity: 1 });
    expect(styleOf(rows()[0]).transform).toEqual(transform);
  });

  describe("grouped", () => {
    const renderGrouped = (selected = "light") =>
      renderWithTheme(
        <ChoiceGroup label={GROUP} variant={LIST_ROW_VARIANT.GROUPED}>
          {OPTIONS.map(({ id, title, subtitle }) => (
            <ChoiceRow
              key={id}
              title={title}
              subtitle={subtitle}
              subtitleLocale={id === "dark" ? AppLocale.AR : undefined}
              selected={selected === id}
              onPress={jest.fn()}
            />
          ))}
        </ChoiceGroup>
      );

    it("reads the rows as radios in a named group", async () => {
      await renderGrouped();

      expect(screen.getByLabelText(GROUP)).toHaveProp("accessibilityRole", "radiogroup");
      expect(rows()).toHaveLength(OPTIONS.length);
    });

    // The group draws the edge and a rule between rows; a row draws neither.
    it("sets the rows in one card, a rule between each", async () => {
      await renderGrouped();

      expect(
        screen.getAllByTestId(LIST_GROUP_PART.DIVIDER, { includeHiddenElements: true })
      ).toHaveLength(OPTIONS.length - 1);
      expect(styleOf(rows()[0]).borderTopWidth).toBeUndefined();
    });

    it("tints the chosen row, which keeps its check", async () => {
      await renderGrouped("dark");

      expect(styleOf(rows()[1])).toMatchObject({ backgroundColor: NEDAA_LIGHT.accentSoft.hex });
      expect(styleOf(rows()[0]).backgroundColor).not.toBe(NEDAA_LIGHT.accentSoft.hex);
      expect(ticks()).toHaveLength(1);
    });

    it("washes a pressed row and keeps its full colour", async () => {
      await renderGrouped();

      await act(() => fireEvent(rows()[1], "responderGrant", { nativeEvent: {} }));

      expect(styleOf(rows()[1])).toMatchObject({
        opacity: 1,
        backgroundColor: NEDAA_LIGHT.pressed.hex,
      });
    });

    it("gives every row a role, a name and a 44pt target", async () => {
      await renderGrouped();

      expect(controlProblems()).toEqual([]);
    });
  });

  // A native name keeps its own script's face, whatever the interface's.
  describe("subtitle font", () => {
    const familyOf = (text: string) =>
      StyleSheet.flatten(screen.getByText(text, { includeHiddenElements: true }).props.style)
        .fontFamily;

    it("sets an Arabic name in the Arabic face under a Latin interface", async () => {
      await renderWithTheme(
        <ChoiceRow
          title="Arabic"
          subtitle="العربية"
          subtitleLocale={AppLocale.AR}
          selected={false}
          onPress={jest.fn()}
        />
      );

      expect(familyOf("العربية")).toMatch(/^IBMPlexSansArabic/);
      expect(familyOf("Arabic")).toMatch(/^IBMPlexSans-/);
    });

    it("sets a Latin name in the Latin face under an Arabic interface", async () => {
      await renderWithTheme(
        <FontLanguage body="ar" heading="ar">
          <ChoiceRow
            title="الإنجليزية"
            subtitle="English"
            subtitleLocale={AppLocale.EN}
            selected={false}
            onPress={jest.fn()}
          />
        </FontLanguage>
      );

      expect(familyOf("English")).toMatch(/^IBMPlexSans-/);
      expect(familyOf("الإنجليزية")).toMatch(/^IBMPlexSansArabic/);
    });
  });
});
