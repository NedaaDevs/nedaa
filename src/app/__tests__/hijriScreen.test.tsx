// First: expo-router's testing library re-mocks Reanimated as it loads, and the
// screen must bind to the mock below, not to its empty one.
import HijriSettings from "@/app/settings/advance/hijri";
import "react-native-gesture-handler/jestSetup";
import { State } from "react-native-gesture-handler";
import { fireGestureHandler, getByGestureTestId } from "react-native-gesture-handler/jest-utils";
import { act, fireEvent, within } from "@testing-library/react-native";
import { renderRouter, screen } from "expo-router/testing-library";

import { STEPPED_SLIDER_GESTURE, STEPPED_SLIDER_PART } from "@/components/ui/stepped-slider";
import { A11Y_ACTION } from "@/constants/Accessibility";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { useLocationStore } from "@/stores/location";
import { usePreferencesStore } from "@/stores/preferences";
import { ThemeProvider } from "@/test-helpers/theme";
import { LTR_ISOLATE } from "@/utils/digits";
import { HIJRI_OFFSETS, hijriAdjustmentLabel } from "@/utils/hijriAdjustment";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
// hijri-native is a native module; the hero reads today's Hijri date from it.
jest.mock("@/utils/date", () => ({
  ...jest.requireActual("@/utils/date"),
  HijriNative: {
    fromTimestamp: () => ({ year: 1448, month: 4, day: 12 }),
    addDays: (date: { day: number }, days: number) => ({ ...date, day: date.day + days }),
  },
}));

const t = i18n.t.bind(i18n);
const hidden = { includeHiddenElements: true } as const;

// A 324pt track with a 24pt thumb puts the eleven stops 30pt apart.
const WIDTH = 324;
const at = (offset: number) => 12 + 30 * HIJRI_OFFSETS.indexOf(offset);

const hijriOn = (day: number) => `${day} ${t("hijriMonths.3")} 1448`;
const GREGORIAN = () => t("today.gregorianDate", { day: "Wednesday", date: "23 September 2026" });

const setOffset = jest.fn((days: number) => useAppStore.setState({ hijriDaysOffset: days }));

const renderHijri = async () => {
  await renderRouter(
    { [BACK_DESTINATION.SETTINGS_HIJRI.route]: () => <HijriSettings /> },
    {
      initialUrl: BACK_DESTINATION.SETTINGS_HIJRI.href as string,
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
    }
  );
  await act(() =>
    fireEvent(screen.getByTestId(STEPPED_SLIDER_PART.TRACK, hidden), "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: WIDTH, height: 44 } },
    })
  );
};

const slider = () =>
  screen.getByRole("adjustable", { name: t("settings.hijri.date.adjustmentTitle") });
/** The hero, found by what it reads: today's dates at `day`. */
const heroOn = (day: number) =>
  screen.queryByLabelText(t("a11y.sentences", { first: hijriOn(day), second: GREGORIAN() }));

type PanEvent = { x: number };
type PanChange = PanEvent & { changeX: number };
/** The pan's callbacks, to hold a drag mid-way; jest-utils always ends one. */
const handlers = () =>
  (
    getByGestureTestId(STEPPED_SLIDER_GESTURE.PAN) as unknown as {
      handlers: {
        onStart: (event: PanEvent) => void;
        onChange: (event: PanChange) => void;
        onEnd: (event: PanEvent, success: boolean) => void;
      };
    }
  ).handlers;

describe("Hijri date screen", () => {
  beforeEach(async () => {
    jest.useFakeTimers({ now: new Date("2026-09-23T09:00:00.000Z") });
    await act(() => i18n.changeLanguage(AppLocale.EN));
    setOffset.mockClear();
    useAppStore.setState({ locale: AppLocale.EN, hijriDaysOffset: 0, setHijirOffset: setOffset });
    usePreferencesStore.setState({ useWesternNumerals: false });
    useLocationStore.setState({
      locationDetails: { ...useLocationStore.getState().locationDetails, timezone: "UTC" },
    });
  });
  afterEach(() => jest.useRealTimers());
  afterAll(async () => {
    await i18n.changeLanguage(AppLocale.EN);
  });

  it("heads the screen with its title", async () => {
    await renderHijri();

    expect(screen.getByRole("header", { name: t("settings.hijri.date.title") })).toBeTruthy();
  });

  it("shows today's dates with the saved correction, read as one element", async () => {
    useAppStore.setState({ hijriDaysOffset: 2 });
    await renderHijri();

    expect(heroOn(14)).toBeTruthy();
  });

  it("follows a drag in the hero and the value, and saves once on release", async () => {
    await renderHijri();

    await act(() => {
      handlers().onStart({ x: at(0) });
      handlers().onChange({ x: at(2), changeX: at(2) - at(0) });
    });

    expect(heroOn(14)).toBeTruthy();
    expect(screen.getByText(hijriAdjustmentLabel(2, t), hidden)).toBeTruthy();
    expect(setOffset).not.toHaveBeenCalled();

    await act(() => handlers().onEnd({ x: at(2) }, true));

    expect(setOffset.mock.calls).toEqual([[2]]);
  });

  it("returns the hero to the saved date when a drag is cancelled", async () => {
    await renderHijri();

    await act(() =>
      fireGestureHandler(getByGestureTestId(STEPPED_SLIDER_GESTURE.PAN), [
        { state: State.BEGAN, x: at(0), translationX: 0 },
        { state: State.ACTIVE, x: at(0), translationX: 0 },
        { x: at(-3), translationX: at(-3) - at(0) },
        { state: State.CANCELLED, x: at(-3), translationX: at(-3) - at(0) },
      ])
    );

    expect(heroOn(12)).toBeTruthy();
    expect(setOffset).not.toHaveBeenCalled();
  });

  it("speaks the offset as its one inflected phrase", async () => {
    useAppStore.setState({ hijriDaysOffset: -2 });
    await renderHijri();

    expect(slider()).toHaveAccessibilityValue({ text: hijriAdjustmentLabel(-2, t) });
  });

  it("steps one day on a screen reader's increment", async () => {
    await renderHijri();

    await act(() =>
      fireEvent(slider(), "accessibilityAction", {
        nativeEvent: { actionName: A11Y_ACTION.INCREMENT },
      })
    );

    expect(setOffset.mock.calls).toEqual([[1]]);
  });

  it("marks the zero stop as the fill's origin", async () => {
    await renderHijri();

    expect(screen.getByTestId(STEPPED_SLIDER_PART.TICK, hidden)).toBeTruthy();
  });

  it.each([
    [AppLocale.EN, "−5", "+5"],
    [AppLocale.AR, "−٥", "+٥"],
  ])("labels the track's ends left to right in %s", async (locale, low, high) => {
    await act(() => i18n.changeLanguage(locale));
    useAppStore.setState({ locale });
    await renderHijri();

    const isolated = (end: string) => `${LTR_ISOLATE.OPEN}${end}${LTR_ISOLATE.CLOSE}`;
    const mark = (part: string) => within(screen.getByTestId(part, hidden));
    // The minus sits at the reading start, so RTL puts it on the right.
    expect(mark(STEPPED_SLIDER_PART.START_MARK).getByText(isolated(low), hidden)).toBeTruthy();
    expect(mark(STEPPED_SLIDER_PART.END_MARK).getByText(isolated(high), hidden)).toBeTruthy();
  });

  it("labels the adjustment section and heads its card with what the slider does", async () => {
    await renderHijri();

    expect(screen.getByText(i18n.t("settings.hijri.date.sections.adjustment"))).toBeTruthy();
    expect(screen.getByText(i18n.t("settings.hijri.date.adjustmentHead"), hidden)).toBeTruthy();
  });
});
