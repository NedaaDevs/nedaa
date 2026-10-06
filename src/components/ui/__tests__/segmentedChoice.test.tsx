import { screen, userEvent } from "@testing-library/react-native";
import { StyleSheet, View } from "react-native";

import { SegmentedChoice } from "@/components/ui/segmented-choice";
import { NEDAA_LIGHT } from "@/constants/Palette";
import { AppDirection, AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import { getDirection, isRTL as isRTLDirection, useAppStore } from "@/stores/app";
import { usePreferencesStore } from "@/stores/preferences";
import { controlProblems } from "@/test-helpers/controls";
import { renderWithTheme } from "@/test-helpers/theme";
import { LTR_ISOLATE } from "@/utils/digits";

const MINUTES = [5, 10, 15, 20, 30] as const;
type Minutes = (typeof MINUTES)[number];

const GROUP = "Minutes after the Athan";
const CORNERS = [
  "borderTopLeftRadius",
  "borderTopRightRadius",
  "borderBottomRightRadius",
  "borderBottomLeftRadius",
] as const;
const spoken = (minutes: Minutes) => i18n.t("common.minute", { count: minutes });

type Setup = {
  value?: Minutes;
  onChange?: (value: Minutes) => void;
  locale?: AppLocale;
  useWesternNumerals?: boolean;
  withSpoken?: boolean;
};

const renderChoice = ({
  value = 15,
  onChange = jest.fn(),
  locale = AppLocale.EN,
  useWesternNumerals = true,
  withSpoken = true,
}: Setup = {}) => {
  useAppStore.setState({ locale });
  usePreferencesStore.setState({ useWesternNumerals });
  return renderWithTheme(
    <SegmentedChoice
      options={MINUTES}
      value={value}
      onChange={onChange}
      accessibilityLabel={GROUP}
      label={String}
      spokenLabel={withSpoken ? spoken : undefined}
    />,
    { isRTL: isRTLDirection(getDirection(locale)) }
  );
};

// A role query needs one accessibility element, and a group must not be one.
const group = () => screen.getByLabelText(GROUP);
const choices = () => screen.getAllByRole("radio");
const styleOf = (element: ReturnType<typeof group>) => StyleSheet.flatten(element.props.style);

describe("SegmentedChoice", () => {
  it("names the group and every choice for a screen reader", async () => {
    await renderChoice();

    expect(group()).toHaveProp("accessibilityRole", "radiogroup");
    expect(choices().map((choice) => choice.props.accessibilityLabel)).toEqual(MINUTES.map(spoken));
  });

  // One element on iOS hides what it holds, so the radios would be unreachable.
  it("keeps the group a container the reader passes through", async () => {
    await renderChoice();

    expect(group().props.accessible).not.toBe(true);
  });

  it("reads only the chosen option as selected", async () => {
    await renderChoice({ value: 20 });

    const selected = screen.getAllByRole("radio", { selected: true });

    expect(selected.map((choice) => choice.props.accessibilityLabel)).toEqual([spoken(20)]);
  });

  it("reports the option pressed", async () => {
    const onChange = jest.fn();
    await renderChoice({ value: 15, onChange });

    await userEvent.setup().press(screen.getByRole("radio", { name: spoken(30) }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(30);
  });

  // A write per press reaches the store; the chosen option has nothing to write.
  it("stays quiet when the chosen option is pressed again", async () => {
    const onChange = jest.fn();
    await renderChoice({ value: 15, onChange });

    await userEvent.setup().press(screen.getByRole("radio", { name: spoken(15) }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("gives every choice a role, a name and a 44pt target", async () => {
    await renderChoice();

    expect(controlProblems()).toEqual([]);
  });

  // Round at any height: the corner reaches half the pill however tall it grows.
  it("draws every choice as a pill", async () => {
    await renderChoice();

    for (const choice of choices()) {
      const style = styleOf(choice);
      for (const corner of CORNERS) {
        expect(Number(style[corner])).toBeGreaterThanOrEqual(Number(style.minHeight) / 2);
      }
    }
  });

  it("wraps onto a new line when the choices do not fit", async () => {
    await renderChoice();

    expect(styleOf(group())).toMatchObject({ flexWrap: "wrap" });
  });

  it("speaks the visible text when no spoken name is given", async () => {
    await renderChoice({ withSpoken: false });

    expect(choices().map((choice) => choice.props.accessibilityLabel)).toEqual(MINUTES.map(String));
  });

  // The row follows the app's direction; row-reverse would flip twice under RTL.
  it.each([
    [AppLocale.EN, AppDirection.LTR],
    [AppLocale.AR, AppDirection.RTL],
    [AppLocale.UR, AppDirection.RTL],
  ] as const)("lays %s choices out %s from the reading start", async (locale, direction) => {
    await renderChoice({ locale });

    expect(styleOf(group())).toMatchObject({ direction, flexDirection: "row" });
    expect(choices().map((choice) => choice.props.accessibilityLabel)).toEqual(MINUTES.map(spoken));
  });

  // Latin digits in RTL text sit in an LTR isolate; Arabic-Indic ones need none.
  it.each([
    [AppLocale.EN, true, "15"],
    [AppLocale.AR, false, "١٥"],
    [AppLocale.AR, true, `${LTR_ISOLATE.OPEN}15${LTR_ISOLATE.CLOSE}`],
    [AppLocale.UR, false, `${LTR_ISOLATE.OPEN}15${LTR_ISOLATE.CLOSE}`],
  ] as const)("writes %s numerals (western: %s) as %s", async (locale, western, shown) => {
    await renderChoice({ locale, useWesternNumerals: western, withSpoken: false });

    expect(screen.getByText(shown)).toBeOnTheScreen();
  });

  it("speaks the numerals the reader chose, without isolate marks", async () => {
    await renderChoice({ locale: AppLocale.AR, useWesternNumerals: false, withSpoken: false });

    expect(screen.getByRole("radio", { name: "١٥" })).toBeOnTheScreen();
  });
});

const SCRIPTS = ["indic", "latin"] as const;
type Script = (typeof SCRIPTS)[number];
const SCRIPT_LABEL: Record<Script, string> = { indic: "١٢٣", latin: "123" };
const SCRIPTS_GROUP = "Numerals";

const renderScripts = (literalDigits?: boolean) => {
  useAppStore.setState({ locale: AppLocale.AR });
  usePreferencesStore.setState({ useWesternNumerals: false });
  return renderWithTheme(
    <SegmentedChoice
      options={SCRIPTS}
      value="indic"
      onChange={jest.fn()}
      accessibilityLabel={SCRIPTS_GROUP}
      label={(option) => SCRIPT_LABEL[option]}
      literalDigits={literalDigits}
    />,
    { isRTL: true }
  );
};

describe("SegmentedChoice literal digits", () => {
  // Options naming numeral styles show each style whatever the preference.
  it("writes every option's digits as given, shown and spoken", async () => {
    await renderScripts(true);

    expect(screen.getByText(`${LTR_ISOLATE.OPEN}123${LTR_ISOLATE.CLOSE}`)).toBeOnTheScreen();
    expect(screen.getAllByRole("radio").map((choice) => choice.props.accessibilityLabel)).toEqual([
      "١٢٣",
      "123",
    ]);
  });

  it("localizes the digits otherwise", async () => {
    await renderScripts();

    expect(screen.getAllByRole("radio").map((choice) => choice.props.accessibilityLabel)).toEqual([
      "١٢٣",
      "١٢٣",
    ]);
  });
});

const PLACES = ["home", "away", "back"] as const;
const GLYPH = "segmented-choice-test-glyph";
const Glyph = () => <View testID={GLYPH} />;

const renderPlaces = () => {
  useAppStore.setState({ locale: AppLocale.EN });
  return renderWithTheme(
    <SegmentedChoice
      options={PLACES}
      value="home"
      onChange={jest.fn()}
      accessibilityLabel="Start on"
      label={String}
      icon={() => Glyph}
    />
  );
};

describe("SegmentedChoice with icons", () => {
  it("draws each option's icon, hidden from the reader", async () => {
    await renderPlaces();

    expect(screen.queryAllByTestId(GLYPH)).toHaveLength(0);
    expect(screen.getAllByTestId(GLYPH, { includeHiddenElements: true })).toHaveLength(
      PLACES.length
    );
    expect(choices().map((choice) => choice.props.accessibilityLabel)).toEqual([...PLACES]);
  });

  // Tiles share the row in equal parts, so a long name cannot crowd the rest.
  it("lays the options out as equal tiles on one line", async () => {
    await renderPlaces();

    expect(styleOf(screen.getByLabelText("Start on"))).toMatchObject({ flexWrap: "nowrap" });
    for (const choice of choices()) {
      expect(styleOf(choice)).toMatchObject({ flexGrow: 1, flexBasis: 0 });
    }
  });

  // The chosen tile carries the strongest fill and edge in the row.
  it("fills the chosen tile with the accent and edges the rest", async () => {
    await renderPlaces();

    expect(choices().map((choice) => styleOf(choice))).toEqual(
      PLACES.map((place) =>
        expect.objectContaining(
          place === "home"
            ? {
                backgroundColor: NEDAA_LIGHT.accentSoft.hex,
                borderTopColor: NEDAA_LIGHT.accentEdge.hex,
              }
            : {
                backgroundColor: NEDAA_LIGHT.surface2Soft.hex,
                borderTopColor: NEDAA_LIGHT.border.hex,
              }
        )
      )
    );
  });

  it("rounds a tile as a control, not a pill", async () => {
    await renderPlaces();

    for (const choice of choices()) {
      expect(styleOf(choice).borderTopLeftRadius).toBe(12);
    }
  });

  it("gives every tile a role, a name and a 44pt target", async () => {
    await renderPlaces();

    expect(controlProblems()).toEqual([]);
  });
});
