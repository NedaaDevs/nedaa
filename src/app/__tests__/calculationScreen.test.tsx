// First: expo-router's testing library re-mocks Reanimated as it loads, and the
// screen must bind to the mock below, not to its empty one.
import CalculationSettings from "@/app/settings/advance/provider";
import AdvanceIndex from "@/app/settings/advance/index";
import { AccessibilityInfo, Text } from "react-native";
import { usePathname } from "expo-router";
import { act, userEvent, waitFor, within } from "@testing-library/react-native";
import { renderRouter, screen } from "expo-router/testing-library";

import { previewTimeId } from "@/components/calculation/TodayPreview";
import { ACTIONSHEET_PART } from "@/components/ui/actionsheet";
import { STICKY_ACTION_PART } from "@/components/ui/sticky-action-bar";
import { BACK_DESTINATION, SETTINGS_ADVANCE } from "@/constants/BackDestinations";
import {
  CALCULATION_PARAM,
  CALCULATION_PICKER,
  CALCULATION_TITLE_KEY,
} from "@/constants/Calculation";
import { OTHER_TIMING, PRAYER_ID } from "@/constants/Prayer";
import { ASR_SCHOOL, MIDNIGHT_MODE, PRAYER_TIME_PROVIDERS } from "@/constants/providers";
import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { useLocationStore } from "@/stores/location";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { usePreferencesStore } from "@/stores/preferences";
import { useProviderSettingsStore } from "@/stores/providerSettings";
import { normalizeRoutePath } from "@/test-helpers/routeTree";
import { ThemeProvider } from "@/test-helpers/theme";
import type { DayPrayerTimes } from "@/types/prayerTimes";
import type { AladhanSettings } from "@/types/providers/aladhan";
import { hijriAdjustmentLabel } from "@/utils/hijriAdjustment";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@gorhom/bottom-sheet", () => jest.requireActual("@/test-helpers/bottomSheetMock"));
jest.mock("expo-widget", () => ({ reloadPrayerWidgets: jest.fn() }));
// hijri-native is a native module; the Hijri row reads today's date from it.
jest.mock("@/utils/date", () => ({
  ...jest.requireActual("@/utils/date"),
  HijriNative: {
    fromTimestamp: () => ({ year: 1448, month: 4, day: 12 }),
    addDays: (date: { day: number }, days: number) => ({ ...date, day: date.day + days }),
  },
}));

const t = i18n.t.bind(i18n);
const ALADHAN = PRAYER_TIME_PROVIDERS.ALADHAN;
const MAKKAH = ALADHAN.methods.find(({ nameKey }) => nameKey === "makkah")!;
const MWL = ALADHAN.methods.find(({ nameKey }) => nameKey === "mwl")!;
const ZONE = "Asia/Riyadh";

const at = (time: string) => `2026-10-13T${time}:00+03:00`;
const TODAY: DayPrayerTimes = {
  date: 20261013,
  timezone: ZONE,
  timings: {
    [PRAYER_ID.FAJR]: at("04:33"),
    [PRAYER_ID.DHUHR]: at("11:53"),
    [PRAYER_ID.ASR]: at("15:12"),
    [PRAYER_ID.MAGHRIB]: at("17:40"),
    [PRAYER_ID.ISHA]: at("19:10"),
  },
  otherTimings: {
    [OTHER_TIMING.SUNRISE]: at("05:50"),
    [OTHER_TIMING.SUNSET]: at("17:40"),
    [OTHER_TIMING.IMSAK]: at("04:23"),
    [OTHER_TIMING.MIDNIGHT]: at("23:45"),
    [OTHER_TIMING.FIRST_THIRD]: at("21:43"),
    [OTHER_TIMING.LAST_THIRD]: at("01:47"),
  },
};

const Pathname = () => <Text testID="pathname">{usePathname()}</Text>;

const renderCalculation = (initial = BACK_DESTINATION.SETTINGS_PROVIDER.href as string) =>
  renderRouter(
    {
      [BACK_DESTINATION.SETTINGS_PROVIDER.route]: () => <CalculationSettings />,
      [SETTINGS_ADVANCE.route]: () => <AdvanceIndex />,
      [BACK_DESTINATION.SETTINGS_HIJRI.route]: () => <Pathname />,
    },
    { initialUrl: initial, wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider> }
  );

const applied = (patch: Partial<AladhanSettings> = {}) =>
  useProviderSettingsStore.setState({
    currentProviderId: ALADHAN.id,
    allSettings: {
      [ALADHAN.id]: { madhab: ASR_SCHOOL.SHAFI, midnightMode: MIDNIGHT_MODE.STANDARD, ...patch },
    },
    draft: null,
    isModified: false,
    pendingReapply: false,
    inEffect: null,
    applying: false,
    applyStep: null,
  });

/** The settings the provider reported for the stored times. */
const reported = (settings: AladhanSettings) =>
  useProviderSettingsStore.setState({ inEffect: settings });

const draft = () => useProviderSettingsStore.getState().getDraftSettings();
const button = (name: string | RegExp) => screen.getByRole("button", { name });
const radio = (name: string | RegExp) => screen.getByRole("radio", { name });
const timeOf = (prayer: string) => screen.getByTestId(previewTimeId(prayer));
/** The preview's spoken label, which starts with its heading. */
const previewLabel = () =>
  String(
    screen.getByLabelText(
      new RegExp(
        `^(${t("settings.calculation.today.title")}|${t("settings.calculation.today.adjusted")})`
      )
    ).props.accessibilityLabel
  );

describe("Calculation screen", () => {
  beforeEach(async () => {
    await act(() => i18n.changeLanguage(AppLocale.EN));
    useAppStore.setState({ locale: AppLocale.EN, hijriDaysOffset: 0 });
    usePreferencesStore.setState({ use24HourTime: true, useWesternNumerals: true });
    useLocationStore.setState({
      localizedLocation: { city: "Riyadh", country: "Saudi Arabia" },
      locationDetails: { ...useLocationStore.getState().locationDetails, timezone: ZONE },
    } as never);
    usePrayerTimesStore.setState({ todayTimings: TODAY, hasError: false, isLoading: false });
    applied({ method: MAKKAH.id });
  });

  it("names the place the choices calculate for", async () => {
    await renderCalculation();

    expect(screen.getByText(t("settings.calculation.intro", { city: "Riyadh" }))).toBeTruthy();
  });

  it("shows the method in effect", async () => {
    await renderCalculation();

    expect(
      button(new RegExp(t(`providers.aladhan.methods.${MAKKAH.nameKey}`).replace(/[()]/g, ".")))
    ).toBeTruthy();
  });

  it("says the provider picks the method when none is set", async () => {
    applied();
    await renderCalculation();

    expect(button(new RegExp(t("settings.summary.methodAuto")))).toBeTruthy();
    expect(screen.getByText(t("settings.calculation.method.autoNote"))).toBeTruthy();
  });

  it("names the method the provider picked for the stored times", async () => {
    applied();
    reported({ method: MAKKAH.id });
    await renderCalculation();

    const card = button(new RegExp(t(CALCULATION_TITLE_KEY[CALCULATION_PICKER.METHOD])));
    expect(card).toHaveAccessibleName(
      new RegExp(t(`providers.aladhan.methods.${MAKKAH.nameKey}`).replace(/[()]/g, "."))
    );
    expect(screen.getByText(t("settings.calculation.method.autoNote"))).toBeTruthy();
    expect(previewLabel()).toContain(t(`providers.aladhan.methods.${MAKKAH.nameKey}`));
  });

  it("names no method for a drafted provider's choice", async () => {
    applied({ method: MWL.id });
    reported({ method: MWL.id });
    useProviderSettingsStore.getState().updateCurrentSettings({ method: undefined });
    await renderCalculation();

    const card = button(new RegExp(t(CALCULATION_TITLE_KEY[CALCULATION_PICKER.METHOD])));
    expect(card).toHaveAccessibleName(new RegExp(t("settings.summary.methodAuto")));
  });

  it("marks the method the provider uses in the sheet", async () => {
    applied();
    reported({ method: MAKKAH.id });
    await renderCalculation();

    await userEvent.press(button(new RegExp(t(CALCULATION_TITLE_KEY[CALCULATION_PICKER.METHOD]))));

    expect(radio(new RegExp(t("settings.calculation.method.inUse")))).toHaveAccessibleName(
      new RegExp(t(`providers.aladhan.methods.${MAKKAH.nameKey}`).replace(/[()]/g, "."))
    );
  });

  it("shows today's times without an apply action while nothing changed", async () => {
    await renderCalculation();

    expect(timeOf(PRAYER_ID.FAJR)).toHaveTextContent("04:33");
    expect(timeOf(PRAYER_ID.DHUHR)).toHaveTextContent("11:53");
    expect(timeOf(PRAYER_ID.ISHA)).toHaveTextContent("19:10");
    expect(screen.queryByTestId(STICKY_ACTION_PART.ROOT)).toBeNull();
  });

  it("drafts a method from the sheet and offers to apply it", async () => {
    await renderCalculation();

    await userEvent.press(button(new RegExp(t("providers.aladhan.method.title"))));
    await userEvent.press(radio(t(`providers.aladhan.methods.${MWL.nameKey}`)));

    expect(draft()?.method).toBe(MWL.id);
    expect(useProviderSettingsStore.getState().getCurrentSettings()?.method).toBe(MAKKAH.id);
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.getByText(t("settings.calculation.today.pending"))).toBeTruthy();
    expect(
      within(screen.getByTestId(STICKY_ACTION_PART.ROOT)).getByRole("button", {
        name: t("settings.calculation.apply"),
      })
    ).toBeTruthy();
  });

  it("holds every choice still while the changes apply", async () => {
    // The fetch never settles, so the apply stays running.
    usePrayerTimesStore.setState({ loadPrayerTimes: () => new Promise<boolean>(() => {}) });
    await renderCalculation();
    await userEvent.press(button(new RegExp(t("settings.calculation.asr.title"))));
    await userEvent.press(radio(new RegExp(t("settings.calculation.asr.options.hanafi.name"))));

    await userEvent.press(button(t("settings.calculation.apply")));

    for (const name of [
      t("providers.aladhan.method.title"),
      t("settings.calculation.asr.title"),
      t("settings.calculation.midnight.title"),
      t("settings.calculation.tuning.title"),
    ]) {
      expect(button(new RegExp(name))).toHaveProp(
        "accessibilityState",
        expect.objectContaining({ disabled: true })
      );
    }
  });

  it("returns the method to the provider's choice", async () => {
    await renderCalculation();

    await userEvent.press(button(new RegExp(t("providers.aladhan.method.title"))));
    await userEvent.press(radio(new RegExp(t("settings.summary.methodAuto"))));

    expect(draft()?.method).toBeUndefined();
  });

  it("filters the methods by the search", async () => {
    await renderCalculation();
    await userEvent.press(button(new RegExp(t("providers.aladhan.method.title"))));

    await userEvent.type(
      screen.getByLabelText(t("settings.calculation.method.searchPlaceholder")),
      "League"
    );

    expect(screen.getAllByRole("radio")).toHaveLength(1);
    expect(radio(t(`providers.aladhan.methods.${MWL.nameKey}`))).toBeTruthy();
  });

  it("says so when no method matches the search", async () => {
    await renderCalculation();
    await userEvent.press(button(new RegExp(t("providers.aladhan.method.title"))));

    await userEvent.type(
      screen.getByLabelText(t("settings.calculation.method.searchPlaceholder")),
      "zzz"
    );

    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.getByText(t("settings.calculation.method.noMatch"))).toBeTruthy();
    // Jest runs as iOS, which has no live regions.
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
      t("settings.calculation.method.noMatch")
    );
  });

  it("drafts the Asr school from its sheet", async () => {
    await renderCalculation();

    await userEvent.press(button(new RegExp(t("settings.calculation.asr.title"))));
    await userEvent.press(radio(new RegExp(t("settings.calculation.asr.options.hanafi.name"))));

    expect(draft()?.madhab).toBe(ASR_SCHOOL.HANAFI);
    expect(button(new RegExp(t("settings.calculation.asr.options.hanafi.name")))).toBeTruthy();
  });

  it("drafts the midnight rule from its sheet", async () => {
    await renderCalculation();

    await userEvent.press(button(new RegExp(t("settings.calculation.midnight.title"))));
    await userEvent.press(
      radio(new RegExp(t("settings.calculation.midnight.options.jafari.name")))
    );

    expect(draft()?.midnightMode).toBe(MIDNIGHT_MODE.JAFARI);
  });

  it("moves the previewed time with a drafted adjustment", async () => {
    await renderCalculation();

    await userEvent.press(button(new RegExp(t("settings.calculation.tuning.title"))));
    const fajr = screen.getByRole("adjustable", { name: t("prayerTimes.fajr") });
    await act(() => fajr.props.onAccessibilityAction({ nativeEvent: { actionName: "increment" } }));

    expect(draft()?.tune?.fajr).toBe(1);

    await userEvent.press(screen.getByTestId(ACTIONSHEET_PART.CLOSE));
    expect(timeOf(PRAYER_ID.FAJR)).toHaveTextContent("04:34");
    expect(screen.getByText(t("settings.calculation.today.adjusted"))).toBeTruthy();
    expect(screen.queryByText(t("settings.calculation.today.pending"))).toBeNull();
    // The row says the minutes, not the drawn sign.
    expect(
      button(new RegExp(t("settings.calculation.tuning.title"))).props.accessibilityLabel
    ).toContain(t("prayerDetail.adjustment.later", { count: 1 }));
  });

  it("previews only what the draft adds to the applied adjustment", async () => {
    applied({ method: MAKKAH.id, tune: { ...ALADHAN.tuning, fajr: 2 } });
    await renderCalculation();

    expect(timeOf(PRAYER_ID.FAJR)).toHaveTextContent("04:33");
  });

  it("names the method the shown times came from while a new one waits", async () => {
    await renderCalculation();

    await userEvent.press(button(new RegExp(t("providers.aladhan.method.title"))));
    await userEvent.press(radio(t(`providers.aladhan.methods.${MWL.nameKey}`)));

    const hero = previewLabel();
    expect(hero).toContain(t(`providers.aladhan.methods.${MAKKAH.nameKey}`));
    expect(hero).not.toContain(t(`providers.aladhan.methods.${MWL.nameKey}`));
  });

  it("previews against the adjustment the provider reports it used", async () => {
    applied({ method: MAKKAH.id, tune: { ...ALADHAN.tuning, fajr: 5 } });
    reported({ method: MAKKAH.id, tune: { ...ALADHAN.tuning, fajr: 2 } });
    useProviderSettingsStore.setState({ pendingReapply: true });
    await renderCalculation();

    // The stored times carry +2; the draft's +5 adds three more.
    expect(timeOf(PRAYER_ID.FAJR)).toHaveTextContent("04:36");
    expect(previewLabel()).toContain(t(`providers.aladhan.methods.${MAKKAH.nameKey}`));
  });

  it("shows the times unshifted while a failed apply waits for its retry", async () => {
    applied({ method: MAKKAH.id, tune: { ...ALADHAN.tuning, fajr: 5 } });
    useProviderSettingsStore.setState({ pendingReapply: true });
    await renderCalculation();

    expect(timeOf(PRAYER_ID.FAJR)).toHaveTextContent("04:33");
    expect(screen.getByText(t("settings.calculation.today.pending"))).toBeTruthy();
    expect(previewLabel()).not.toContain(t(`providers.aladhan.methods.${MAKKAH.nameKey}`));
  });

  it("reads as adjusted for a tuned timing it does not show", async () => {
    await renderCalculation();

    await userEvent.press(button(new RegExp(t("settings.calculation.tuning.title"))));
    const asr = screen.getByRole("adjustable", { name: t("prayerTimes.asr") });
    await act(() => asr.props.onAccessibilityAction({ nativeEvent: { actionName: "increment" } }));
    await userEvent.press(screen.getByTestId(ACTIONSHEET_PART.CLOSE));

    expect(screen.getByText(t("settings.calculation.today.adjusted"))).toBeTruthy();
  });

  it("names Friday's Dhuhr as Today does", async () => {
    const friday = (time: string) => `2026-10-16T${time}:00+03:00`;
    usePrayerTimesStore.setState({
      todayTimings: {
        ...TODAY,
        timings: { ...TODAY.timings, [PRAYER_ID.DHUHR]: friday("11:53") },
      },
    });
    await renderCalculation();

    expect(previewLabel()).toContain(t("prayerTimes.jumuah"));
  });

  it("leads to the Hijri date with its correction", async () => {
    useAppStore.setState({ hijriDaysOffset: 1 });
    await renderCalculation();

    const row = button(new RegExp(`13 ${t("hijriMonths.3")} 1448`));
    expect(row.props.accessibilityLabel).toContain(hijriAdjustmentLabel(1, t));

    await userEvent.press(row);

    expect(screen.getByTestId("pathname")).toHaveTextContent(
      normalizeRoutePath(BACK_DESTINATION.SETTINGS_HIJRI.href)
    );
  });

  it("offers a retry in place of the times when they failed to load", async () => {
    usePrayerTimesStore.setState({ todayTimings: null, hasError: true });
    await renderCalculation();

    expect(screen.getByRole("button", { name: t("common.retry") })).toBeTruthy();
  });

  it("opens from the advanced settings path", async () => {
    await renderCalculation(SETTINGS_ADVANCE.href);

    expect(screen.getByText(t("settings.calculation.intro", { city: "Riyadh" }))).toBeTruthy();
  });
});

describe("Adjustment sheet", () => {
  const TUNING_TITLE = () => new RegExp(t("settings.calculation.tuning.title"));
  const openTuning = () => userEvent.press(button(TUNING_TITLE()));
  const stepper = (name: string) => screen.getByRole("adjustable", { name });
  const step = (name: string, actionName: "increment" | "decrement") =>
    act(() => stepper(name).props.onAccessibilityAction({ nativeEvent: { actionName } }));

  beforeEach(async () => {
    await act(() => i18n.changeLanguage(AppLocale.EN));
    useAppStore.setState({ locale: AppLocale.EN, hijriDaysOffset: 0 });
    usePreferencesStore.setState({ use24HourTime: true, useWesternNumerals: true });
    useLocationStore.setState({
      localizedLocation: { city: "Riyadh", country: "Saudi Arabia" },
      locationDetails: { ...useLocationStore.getState().locationDetails, timezone: ZONE },
    } as never);
    usePrayerTimesStore.setState({ todayTimings: TODAY, hasError: false, isLoading: false });
    applied({ method: MAKKAH.id });
  });

  it("shows each prayer's resulting time inside its control", async () => {
    await renderCalculation();
    await openTuning();

    expect(within(stepper(t("prayerTimes.fajr"))).getByText("04:33")).toBeTruthy();
    await step(t("prayerTimes.fajr"), "increment");
    await step(t("prayerTimes.fajr"), "increment");

    const fajr = stepper(t("prayerTimes.fajr"));
    expect(within(fajr).getByText("04:35")).toBeTruthy();
    expect(fajr.props.accessibilityValue.text).toContain(
      t("prayerDetail.adjustment.later", { count: 2 })
    );
  });

  it("notes the offset and the calculated time under a moved row", async () => {
    applied({ method: MAKKAH.id, tune: { ...ALADHAN.tuning, isha: -3 } });
    await renderCalculation();
    await openTuning();

    expect(
      screen.getByText(
        t("a11y.join", {
          first: t("prayerDetail.adjustment.earlier", { count: 3 }),
          second: t("settings.calculation.tuning.calculated", { time: "19:13" }),
        }),
        // The control speaks for its row, so the drawn note is hidden from it.
        { includeHiddenElements: true }
      )
    ).toBeTruthy();
  });

  it("folds sunrise, sunset and midnight under other times", async () => {
    await renderCalculation();
    await openTuning();

    expect(screen.queryByRole("adjustable", { name: t("otherTimings.sunrise") })).toBeNull();
    await userEvent.press(button(t("otherTimings.title")));

    expect(stepper(t("otherTimings.sunrise"))).toBeTruthy();
    expect(stepper(t("otherTimings.midnight"))).toBeTruthy();
  });

  it("opens other times by itself when one of them is moved", async () => {
    applied({ method: MAKKAH.id, tune: { ...ALADHAN.tuning, sunset: -1 } });
    await renderCalculation();
    await openTuning();

    // The stored times already carry the applied minute.
    expect(within(stepper(t("otherTimings.sunset"))).getByText("17:40")).toBeTruthy();
  });

  it("closes with the sheet's own button, leaving saving to Apply", async () => {
    await renderCalculation();
    await openTuning();

    expect(screen.getByTestId(ACTIONSHEET_PART.CLOSE)).toBeTruthy();
  });

  it("removes every adjustment, and stays in place when there is none", async () => {
    applied({ method: MAKKAH.id, tune: { ...ALADHAN.tuning, fajr: 2, isha: -3 } });
    await renderCalculation();
    await openTuning();

    await userEvent.press(button(t("providers.aladhan.tuning.resetAll")));

    expect(draft()?.tune).toEqual(ALADHAN.tuning);
    expect(button(t("providers.aladhan.tuning.resetAll"))).toBeDisabled();
  });

  it("shows offsets alone while the draft changes the method", async () => {
    applied({ method: MAKKAH.id, tune: { ...ALADHAN.tuning, fajr: 2 } });
    await renderCalculation();
    await userEvent.press(button(new RegExp(t("providers.aladhan.method.title"))));
    await userEvent.press(radio(t(`providers.aladhan.methods.${MWL.nameKey}`)));
    await openTuning();

    expect(within(stepper(t("prayerTimes.fajr"))).queryByText("04:33")).toBeNull();
    expect(screen.getAllByText(t("settings.calculation.today.pending")).length).toBeGreaterThan(0);
  });

  it("shows offsets alone while today's times are missing", async () => {
    usePrayerTimesStore.setState({ todayTimings: null });
    await renderCalculation();
    await openTuning();

    expect(screen.getByText(t("settings.calculation.tuning.unavailable"))).toBeTruthy();
  });

  it("names the first two moved times and counts the rest", async () => {
    applied({
      method: MAKKAH.id,
      tune: { ...ALADHAN.tuning, fajr: 2, dhuhr: 1, asr: 3, isha: -1 },
    });
    await renderCalculation();

    const more = t("settings.calculation.tuning.more", { count: 2 });
    const summary = screen.getByText(new RegExp(`^${t("prayerTimes.fajr")}.*${more}$`), {
      includeHiddenElements: true,
    });
    expect(summary).not.toHaveTextContent(new RegExp(t("prayerTimes.asr")));
  });

  // Every number the sheet draws: times, chips, notes and the summary.
  it.each([
    { western: false, kept: /[٠-٩]/, banned: /[0-9]/ },
    { western: true, kept: /[0-9]/, banned: /[٠-٩]/ },
  ])(
    "writes every number in the reader's digits (western: $western)",
    async ({ western, kept, banned }) => {
      await act(() => i18n.changeLanguage(AppLocale.AR));
      useAppStore.setState({ locale: AppLocale.AR });
      usePreferencesStore.setState({ useWesternNumerals: western });
      applied({ method: MAKKAH.id, tune: { ...ALADHAN.tuning, fajr: 2, isha: -3, asr: 1 } });
      await renderCalculation();
      await openTuning();

      const numbers = screen
        .getAllByText(/[0-9٠-٩]/, { includeHiddenElements: true })
        .map((node) => String(node.props.children));
      expect(numbers.length).toBeGreaterThan(5);
      numbers.forEach((text) => {
        expect(text).toMatch(kept);
        expect(text).not.toMatch(banned);
      });
    }
  );

  it("shows offsets alone after a failed apply that changed the Asr school", async () => {
    applied({ method: MAKKAH.id, madhab: ASR_SCHOOL.HANAFI });
    reported({ method: MAKKAH.id, madhab: ASR_SCHOOL.SHAFI });
    useProviderSettingsStore.setState({ pendingReapply: true });
    await renderCalculation();
    await openTuning();

    expect(within(stepper(t("prayerTimes.asr"))).queryByText("15:12")).toBeNull();
  });

  it("names no method for automatic after a failed switch to it", async () => {
    applied();
    reported({ method: MWL.id });
    useProviderSettingsStore.setState({ pendingReapply: true });
    await renderCalculation();

    const card = button(new RegExp(t(CALCULATION_TITLE_KEY[CALCULATION_PICKER.METHOD])));
    expect(card).toHaveAccessibleName(new RegExp(t("settings.summary.methodAuto")));
  });

  it("speaks the calculated time of a moved row", async () => {
    applied({ method: MAKKAH.id, tune: { ...ALADHAN.tuning, isha: -3 } });
    await renderCalculation();
    await openTuning();

    expect(stepper(t("prayerTimes.isha")).props.accessibilityValue.text).toMatch(
      new RegExp(t("settings.calculation.tuning.calculated", { time: ".+" }))
    );
  });

  it("ignores a link to a timing that is not tunable", async () => {
    await renderCalculation(
      `${BACK_DESTINATION.SETTINGS_PROVIDER.href}?${CALCULATION_PARAM.TUNE}=lunch`
    );

    expect(screen.queryByRole("adjustable", { name: t("prayerTimes.fajr") })).toBeNull();
  });

  it("opens the link's prayer only the first time", async () => {
    const focus = jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent");
    const focusedLabels = () =>
      focus.mock.calls.map(
        ([node]) => (node as { props?: { accessibilityLabel?: string } }).props?.accessibilityLabel
      );
    await renderCalculation(
      `${BACK_DESTINATION.SETTINGS_PROVIDER.href}?${CALCULATION_PARAM.TUNE}=${PRAYER_ID.ASR}`
    );
    await waitFor(() => expect(focusedLabels()).toContain(t("prayerTimes.asr")));
    await userEvent.press(screen.getByTestId(ACTIONSHEET_PART.CLOSE));
    focus.mockClear();

    await openTuning();

    await waitFor(() => expect(focus).toHaveBeenCalled());
    expect(focusedLabels()).not.toContain(t("prayerTimes.asr"));
    focus.mockRestore();
  });

  it("opens on the prayer a link names, with reader focus on it", async () => {
    const focus = jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent");
    await renderCalculation(
      `${BACK_DESTINATION.SETTINGS_PROVIDER.href}?${CALCULATION_PARAM.TUNE}=${PRAYER_ID.ASR}`
    );

    expect(stepper(t("prayerTimes.asr"))).toBeTruthy();
    await waitFor(() => {
      const focused = focus.mock.calls.map(
        ([node]) => (node as { props?: { accessibilityLabel?: string } }).props?.accessibilityLabel
      );
      expect(focused).toContain(t("prayerTimes.asr"));
    });
    focus.mockRestore();
  });
});
