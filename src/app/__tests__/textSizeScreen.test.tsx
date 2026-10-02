// First: expo-router's testing library re-mocks Reanimated as it loads, and the
// screen must bind to the mock below, not to its empty one.
import TextSizeScreen from "@/app/settings/textSize";
import "react-native-gesture-handler/jestSetup";
import { StyleSheet } from "react-native";
import { State } from "react-native-gesture-handler";
import { fireGestureHandler, getByGestureTestId } from "react-native-gesture-handler/jest-utils";
import { act, fireEvent, within } from "@testing-library/react-native";
import { renderRouter, screen } from "expo-router/testing-library";

import { TEXT_SIZE_PREVIEW_PART } from "@/components/settings/TextSizePreview";
import { TODAY_HEADER_PART } from "@/components/today/TodayHeader";
import { SKY_PART } from "@/components/ui/sky-background";
import { STEPPED_SLIDER_GESTURE, STEPPED_SLIDER_PART } from "@/components/ui/stepped-slider";
import { A11Y_ACTION } from "@/constants/Accessibility";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { NEDAA_LIGHT } from "@/constants/Palette";
import { OTHER_TIMING, PRAYER_ID } from "@/constants/Prayer";
import { TEXT_SIZE_MULTIPLIERS } from "@/constants/TextSize";
import { AppLocale, AppMode, TextSize, type TextSizeValue } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { useLocationStore } from "@/stores/location";
import { usePreferencesStore } from "@/stores/preferences";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import type { DayPrayerTimes } from "@/types/prayerTimes";
import { ThemeProvider } from "@/test-helpers/theme";
import { prayerNameKey } from "@/utils/prayerName";
import { fontSizeOf, styleOf } from "@/test-helpers/text";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@/utils/date", () => ({
  ...jest.requireActual("@/utils/date"),
  HijriNative: {
    fromTimestamp: () => ({ year: 1448, month: 4, day: 3 }),
    addDays: (date: { day: number }, days: number) => ({ ...date, day: date.day + days }),
  },
}));

/** Wednesday 23 September 2026. */
const TODAY: DayPrayerTimes = {
  date: 20260923,
  timezone: "UTC",
  timings: {
    [PRAYER_ID.FAJR]: "2026-09-23T04:30:00.000Z",
    [PRAYER_ID.DHUHR]: "2026-09-23T12:00:00.000Z",
    [PRAYER_ID.ASR]: "2026-09-23T15:20:00.000Z",
    [PRAYER_ID.MAGHRIB]: "2026-09-23T18:05:00.000Z",
    [PRAYER_ID.ISHA]: "2026-09-23T19:25:00.000Z",
  },
  otherTimings: {
    [OTHER_TIMING.SUNRISE]: "2026-09-23T05:50:00.000Z",
  } as DayPrayerTimes["otherTimings"],
};

const t = i18n.t.bind(i18n);
const hidden = { includeHiddenElements: true } as const;
const PRESETS = Object.values(TextSize);
const CITY = "Riyadh";

// A 324pt track with a 24pt thumb puts the four stops 100pt apart.
const WIDTH = 324;
const AT = [12, 112, 212, 312] as const;

const renderTextSize = async () => {
  await renderRouter(
    { [BACK_DESTINATION.SETTINGS_TEXT_SIZE.route]: () => <TextSizeScreen /> },
    {
      initialUrl: BACK_DESTINATION.SETTINGS_TEXT_SIZE.href as string,
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
    }
  );
  await act(() =>
    fireEvent(screen.getByTestId(STEPPED_SLIDER_PART.TRACK, hidden), "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: WIDTH, height: 44 } },
    })
  );
};

type PanEvent = { x: number };
type PanChange = PanEvent & { changeX: number };
/** The pan's callbacks, to hold a drag mid-way; jest-utils always ends one. */
const pan = () =>
  (
    getByGestureTestId(STEPPED_SLIDER_GESTURE.PAN) as unknown as {
      handlers: {
        onStart: (event: PanEvent) => void;
        onChange: (event: PanChange) => void;
        onEnd: (event: PanEvent, success: boolean) => void;
      };
    }
  ).handlers;

const hijriDate = `3 ${t("hijriMonths.3")} 1448`;
const copy = (part: string) => within(screen.getByTestId(part, hidden));
const shown = () => copy(TEXT_SIZE_PREVIEW_PART.FRAME);
const previewDateSize = () => styleOf(shown().getByText(hijriDate, hidden)).fontSize;
const titleSize = () => styleOf(screen.getByText(t("settings.textSize.title"))).fontSize;
const slider = () => screen.getByRole("adjustable", { name: t("settings.textSize.title") });

describe("Text size", () => {
  beforeEach(async () => {
    jest.useFakeTimers({ now: new Date("2026-09-23T14:02:00.000Z") });
    await act(() => i18n.changeLanguage(AppLocale.EN));
    useAppStore.setState({ mode: AppMode.LIGHT, locale: AppLocale.EN, hijriDaysOffset: 0 });
    usePreferencesStore.setState({ textSize: TextSize.DEFAULT, useWesternNumerals: false });
    usePrayerTimesStore.setState({
      yesterdayTimings: null,
      todayTimings: TODAY,
      tomorrowTimings: null,
    });
    useLocationStore.setState({
      localizedLocation: { city: CITY, country: "Saudi Arabia" },
      locationDetails: { ...useLocationStore.getState().locationDetails, timezone: "UTC" },
    });
  });
  afterEach(() => jest.useRealTimers());

  it("states what it changes and where the Quran's size lives", async () => {
    await renderTextSize();

    expect(screen.getByText(t("settings.textSize.intro"))).toBeOnTheScreen();
    expect(t("settings.textSize.intro")).toContain(t("brand.name"));
    expect(screen.getByText(t("settings.textSize.quranNote"))).toBeOnTheScreen();
    // On a surface, so it reads in the text colour, not the sky's muted tone.
    expect(styleOf(screen.getByText(t("settings.textSize.quranNote"))).color).toBe(
      NEDAA_LIGHT.fg.hex
    );
    // A fact, not a link: nothing on the page but the back control is a button.
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("draws the page sky once, with no sky in the preview", async () => {
    await renderTextSize();

    expect(screen.getAllByTestId(SKY_PART.CANVAS, hidden)).toHaveLength(1);
    expect(screen.queryAllByTestId(SKY_PART.PREVIEW, hidden)).toEqual([]);
  });

  it("previews Today's own header and prayer cards as one quiet element", async () => {
    await renderTextSize();

    const preview = screen.getByLabelText(t("a11y.textSize.preview"));
    expect(preview.props.testID).toBe(TEXT_SIZE_PREVIEW_PART.FRAME);
    expect(shown().getByTestId(TODAY_HEADER_PART.DATES, hidden)).toBeOnTheScreen();
    expect(shown().getByText(t(prayerNameKey(PRAYER_ID.ASR, false)), hidden)).toBeOnTheScreen();
    // Only the next prayer's card, so the screen stays short.
    expect(shown().queryByText(t(prayerNameKey(PRAYER_ID.FAJR, false)), hidden)).toBeNull();
    // Today's place and cards are buttons; here nothing inside is reachable.
    expect(
      screen.queryByRole("button", { name: t("a11y.location.currentCity", { city: CITY }) })
    ).toBeNull();
    expect(
      StyleSheet.flatten(preview.props.style)?.pointerEvents ?? preview.props.pointerEvents
    ).toBe("none");
  });

  it("names what it previews in a label the eye reads, not only the screen reader", async () => {
    await renderTextSize();

    // Outside the subtree hidden from readers, so found without them.
    const frame = within(screen.getByTestId(TEXT_SIZE_PREVIEW_PART.FRAME));
    expect(frame.getByText(t("settings.textSize.preview"))).toBeOnTheScreen();
    expect(t("a11y.textSize.preview")).toBe(t("settings.textSize.preview"));
  });

  // Above the preview, the slider shows first and the preview grows away from it.
  it("puts the slider above the preview", async () => {
    await renderTextSize();

    const order: string[] = [];
    const walk = (node: unknown): void => {
      if (!node || typeof node !== "object") return;
      const { props, children } = node as { props?: Record<string, unknown>; children?: unknown };
      if (props?.accessibilityRole === "adjustable") order.push("slider");
      if (props?.testID === TEXT_SIZE_PREVIEW_PART.FRAME) order.push("preview");
      (Array.isArray(children) ? children : [children]).forEach(walk);
    };
    walk(screen.toJSON());

    expect(order).toEqual(["slider", "preview"]);
  });

  it("offers the four presets in order, naming the chosen one", async () => {
    usePreferencesStore.setState({ textSize: TextSize.LARGE });
    await renderTextSize();

    expect(slider()).toHaveAccessibilityValue({
      min: 0,
      max: PRESETS.length - 1,
      now: 1,
      text: t("settings.textSize.options.large"),
    });
    for (const preset of PRESETS)
      expect(screen.getByText(t(`settings.textSize.options.${preset}`), hidden)).toBeOnTheScreen();
  });

  it("scales the preview to a dragged size while the page and store wait", async () => {
    await renderTextSize();
    const before = titleSize();

    await act(() => {
      pan().onStart({ x: AT[0] });
      pan().onChange({ x: AT[3], changeX: AT[3] - AT[0] });
    });

    expect(previewDateSize()).toBe(fontSizeOf("4xl") * TEXT_SIZE_MULTIPLIERS[TextSize.MAX]);
    expect(titleSize()).toBe(before);
    expect(usePreferencesStore.getState().textSize).toBe(TextSize.DEFAULT);
  });

  it("writes the store once, on release", async () => {
    await renderTextSize();
    const writes: TextSizeValue[] = [];
    const stop = usePreferencesStore.subscribe((state, previous) => {
      if (state.textSize !== previous.textSize) writes.push(state.textSize);
    });

    await act(() =>
      fireGestureHandler(getByGestureTestId(STEPPED_SLIDER_GESTURE.PAN), [
        { state: State.BEGAN, x: AT[0] },
        { state: State.ACTIVE, x: AT[0] },
        { x: AT[1] },
        { x: AT[2] },
        { state: State.END, x: AT[2] },
      ])
    );
    stop();

    expect(writes).toEqual([TextSize.XLARGE]);
    expect(previewDateSize()).toBe(fontSizeOf("4xl") * TEXT_SIZE_MULTIPLIERS[TextSize.XLARGE]);
  });

  it("returns the preview to the stored size when a drag is cancelled", async () => {
    await renderTextSize();

    await act(() => {
      pan().onStart({ x: AT[0] });
      pan().onChange({ x: AT[3], changeX: AT[3] - AT[0] });
      pan().onEnd({ x: AT[3] }, false);
    });

    expect(previewDateSize()).toBe(fontSizeOf("4xl"));
    expect(usePreferencesStore.getState().textSize).toBe(TextSize.DEFAULT);
  });

  it("steps one preset at a time with a screen reader", async () => {
    await renderTextSize();

    await act(() =>
      fireEvent(slider(), "accessibilityAction", {
        nativeEvent: { actionName: A11Y_ACTION.INCREMENT },
      })
    );

    expect(usePreferencesStore.getState().textSize).toBe(TextSize.LARGE);
  });
});
