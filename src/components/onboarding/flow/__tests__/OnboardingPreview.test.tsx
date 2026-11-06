import { parseISO } from "date-fns";
import { act, screen, within } from "@testing-library/react-native";
import { useSharedValue, withDelay, withRepeat, withTiming } from "react-native-reanimated";

import { OnboardingPreview } from "@/components/onboarding/flow/OnboardingPreview";
import { PrayerGrid } from "@/components/today/PrayerGrid";
import { LOOP_FOREVER } from "@/constants/Motion";
import { ONBOARDING_PART, PREVIEW_MOTION, TIME_PLACEHOLDER } from "@/constants/Onboarding";
import { NEDAA_LIGHT } from "@/constants/Palette";
import { PRAYER_ID, PRAYER_IDS, type PrayerId } from "@/constants/Prayer";
import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { useLocationStore } from "@/stores/location";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { usePreferencesStore } from "@/stores/preferences";
import { RIYADH_DAY, RIYADH_ZONE, riyadhAt } from "@/test-helpers/prayerDay";
import { renderWithTheme } from "@/test-helpers/theme";
import { spokenClockTime } from "@/utils/spokenClockTime";

jest.mock("react-native-reanimated", () => {
  const reanimated = jest.requireActual("@/test-helpers/reanimatedMock");
  // Spied, so a test can read the value each chip mounts with.
  return { __esModule: true, ...reanimated, useSharedValue: jest.fn(reanimated.useSharedValue) };
});
let mockReduced = false;
jest.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => mockReduced }));
// hijri-native is a native module; the dates read today from it.
jest.mock("@/utils/date", () => jest.requireActual("@/test-helpers/hijriDateMock"));

const t = i18n.t.bind(i18n);
const NOTE = "a note from the caller";
const chipId = (id: PrayerId) => `${ONBOARDING_PART.PREVIEW_CHIP}-${id}`;
const spoken = (iso: string) =>
  spokenClockTime(
    parseISO(iso),
    RIYADH_ZONE,
    { locale: AppLocale.EN, use24HourTime: true, western: true },
    t
  );

beforeEach(async () => {
  mockReduced = false;
  jest.mocked(withRepeat).mockClear();
  jest.mocked(withDelay).mockClear();
  jest.mocked(withTiming).mockClear();
  jest.mocked(useSharedValue).mockClear();
  await act(() => i18n.changeLanguage(AppLocale.EN));
  useAppStore.setState({ locale: AppLocale.EN, hijriDaysOffset: 0 });
  usePreferencesStore.setState({ use24HourTime: true, useWesternNumerals: true });
  useLocationStore.setState({
    localizedLocation: { city: "Riyadh", country: "Saudi Arabia" },
    locationDetails: { ...useLocationStore.getState().locationDetails, timezone: RIYADH_ZONE },
  });
  usePrayerTimesStore.setState({
    todayTimings: null,
    yesterdayTimings: null,
    tomorrowTimings: null,
    usingDefaultLocation: false,
  });
});

it("shows five dashed times and the no-times line before a fetch", async () => {
  await renderWithTheme(<OnboardingPreview />);

  expect(screen.getAllByText(TIME_PLACEHOLDER)).toHaveLength(PRAYER_IDS.length);
  expect(screen.getByText(t("onboarding.preview.noTimes"))).toBeTruthy();
});

it("is one element that speaks the stored day's times", async () => {
  usePrayerTimesStore.setState({ todayTimings: RIYADH_DAY });
  await renderWithTheme(<OnboardingPreview />);

  const card = screen.getByTestId(ONBOARDING_PART.PREVIEW);
  expect(card.props.accessible).toBe(true);
  for (const id of PRAYER_IDS) {
    expect(card.props.accessibilityLabel).toContain(spoken(RIYADH_DAY.timings[id]));
  }
  expect(screen.queryByText(TIME_PLACEHOLDER)).toBeNull();
  expect(screen.queryByText(t("onboarding.preview.noTimes"))).toBeNull();
});

// Each chip's value fades in a beat after the one before it.
it("fades the times in, one chip after another", async () => {
  usePrayerTimesStore.setState({ todayTimings: RIYADH_DAY });
  await renderWithTheme(<OnboardingPreview />);

  expect(jest.mocked(withDelay).mock.calls.map(([delay]) => delay)).toEqual(
    PRAYER_IDS.map((_, index) => index * PREVIEW_MOTION.STAGGER_MS)
  );
  expect(withTiming).toHaveBeenCalledWith(1, { duration: PREVIEW_MOTION.FADE_MS });
});

// A chip that mounted shown would blink out before its fade in.
it("mounts each chip's value hidden, ready to fade in", async () => {
  await renderWithTheme(<OnboardingPreview />);

  expect(useSharedValue).toHaveBeenCalledWith(0);
});

it("mounts each chip's value shown under Reduce Motion", async () => {
  mockReduced = true;
  await renderWithTheme(<OnboardingPreview />);

  expect(useSharedValue).not.toHaveBeenCalledWith(0);
});

// Arabic writes «ص» after the digits; the whole time is not one LTR run.
it("writes an Arabic 12-hour time as Today's prayer grid does", async () => {
  await act(() => i18n.changeLanguage(AppLocale.AR));
  useAppStore.setState({ locale: AppLocale.AR });
  usePreferencesStore.setState({ use24HourTime: false, useWesternNumerals: false });
  usePrayerTimesStore.setState({ todayTimings: RIYADH_DAY });
  await renderWithTheme(
    <>
      <OnboardingPreview />
      <PrayerGrid onSelect={jest.fn()} />
    </>,
    { isRTL: true }
  );

  const shown = within(screen.getByTestId(chipId(PRAYER_ID.FAJR))).getByText(/[٠-٩]/);
  expect(screen.getAllByText(String(shown.props.children))).toHaveLength(2);
});

describe("the next prayer's chip", () => {
  // Tamagui writes a border's colour side by side.
  const ACCENT = {
    borderTopColor: NEDAA_LIGHT.accent.hex,
    borderRightColor: NEDAA_LIGHT.accent.hex,
    borderBottomColor: NEDAA_LIGHT.accent.hex,
    borderLeftColor: NEDAA_LIGHT.accent.hex,
  };
  // Dhuhr's 11:53 is past its active window by 12:30, so Asr is next.
  beforeEach(() => jest.useFakeTimers({ now: new Date(riyadhAt("12:30")) }));
  afterEach(() => jest.useRealTimers());

  it("is drawn in the accent, and no other chip is", async () => {
    usePrayerTimesStore.setState({ todayTimings: RIYADH_DAY });
    await renderWithTheme(<OnboardingPreview />);

    expect(screen.getByTestId(chipId(PRAYER_ID.ASR))).toHaveStyle(ACCENT);
    for (const id of PRAYER_IDS.filter((other) => other !== PRAYER_ID.ASR)) {
      expect(screen.getByTestId(chipId(id))).not.toHaveStyle(ACCENT);
    }
  });

  it("is not marked for the default place's day", async () => {
    usePrayerTimesStore.setState({ todayTimings: RIYADH_DAY, usingDefaultLocation: true });
    await renderWithTheme(<OnboardingPreview />);

    for (const id of PRAYER_IDS) expect(screen.getByTestId(chipId(id))).not.toHaveStyle(ACCENT);
  });
});

it("shows no times when the stored day is the default place's, not the user's", async () => {
  usePrayerTimesStore.setState({ todayTimings: RIYADH_DAY, usingDefaultLocation: true });
  await renderWithTheme(<OnboardingPreview />);

  expect(screen.getAllByText(TIME_PLACEHOLDER)).toHaveLength(PRAYER_IDS.length);
  expect(screen.getByText(t("onboarding.preview.noTimes"))).toBeTruthy();
  const label = screen.getByTestId(ONBOARDING_PART.PREVIEW).props.accessibilityLabel;
  for (const id of PRAYER_IDS) expect(label).not.toContain(spoken(RIYADH_DAY.timings[id]));
});

it("names the place, says when none is set, and takes the caller's note", async () => {
  const view = await renderWithTheme(<OnboardingPreview />);
  expect(
    screen.getByText(t("place.name", { city: "Riyadh", country: "Saudi Arabia" }))
  ).toBeTruthy();

  await act(async () =>
    useLocationStore.setState({
      localizedLocation: { city: "", country: "" },
      locationDetails: { ...useLocationStore.getState().locationDetails, address: null },
    })
  );
  expect(screen.getByText(t("onboarding.preview.noCity"))).toBeTruthy();

  await view.rerender(<OnboardingPreview placeNote={NOTE} />);
  expect(screen.getByText(NOTE)).toBeTruthy();
});

it("takes the caller's times note in place of the no-times line, and speaks it", async () => {
  await renderWithTheme(<OnboardingPreview timesNote={NOTE} />);

  expect(screen.getByText(NOTE)).toBeTruthy();
  expect(screen.queryByText(t("onboarding.preview.noTimes"))).toBeNull();
  const label = screen.getByTestId(ONBOARDING_PART.PREVIEW).props.accessibilityLabel;
  expect(label).toContain(NOTE);
  expect(label).not.toContain(t("onboarding.preview.noTimes"));
});

it("drops the times note once the day's times show", async () => {
  usePrayerTimesStore.setState({ todayTimings: RIYADH_DAY });
  await renderWithTheme(<OnboardingPreview timesNote={NOTE} />);

  expect(screen.queryByText(NOTE)).toBeNull();
  expect(screen.getByTestId(ONBOARDING_PART.PREVIEW).props.accessibilityLabel).not.toContain(NOTE);
});

describe("while the times load", () => {
  const times = () => screen.getByTestId(ONBOARDING_PART.PREVIEW_TIMES);
  const values = () => screen.getAllByText(TIME_PLACEHOLDER);

  it("pulses the row of times, looping, and mutes their values", async () => {
    await renderWithTheme(<OnboardingPreview loading />);

    expect(withRepeat).toHaveBeenCalledWith(expect.anything(), LOOP_FOREVER, true);
    expect(times()).toHaveStyle({ opacity: PREVIEW_MOTION.PULSE_OPACITY });
    for (const value of values()) expect(value).toHaveStyle({ color: NEDAA_LIGHT.mutedSky.hex });
  });

  it("holds the row still under Reduce Motion, values still muted", async () => {
    mockReduced = true;
    await renderWithTheme(<OnboardingPreview loading />);

    expect(withRepeat).not.toHaveBeenCalled();
    expect(times()).toHaveStyle({ opacity: 1 });
    for (const value of values()) expect(value).toHaveStyle({ color: NEDAA_LIGHT.mutedSky.hex });
  });

  it("stops the pulse and draws the values plainly once loading ends", async () => {
    const view = await renderWithTheme(<OnboardingPreview loading />);

    await view.rerender(<OnboardingPreview />);

    expect(times()).toHaveStyle({ opacity: 1 });
    for (const value of values()) expect(value).toHaveStyle({ color: NEDAA_LIGHT.fg.hex });
  });
});
