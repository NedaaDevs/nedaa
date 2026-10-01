// First: expo-router's testing library re-mocks Reanimated as it loads, and the
// screen must bind to the mock below, not to its empty one.
import AppearanceScreen from "@/app/settings/theme";
import { act, userEvent, waitFor, within } from "@testing-library/react-native";
import { renderRouter, screen } from "expo-router/testing-library";

import { SKY_PART } from "@/components/ui/sky-background";
import { SKY_HERO_ID } from "@/components/ui/sky-preview";
import { ThemeTransitionContext } from "@/components/ui/theme-transition/context";
import { NATIVE_SCHEME } from "@/constants/Appearance";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { PHASE, type Phase } from "@/constants/Phase";
import { BODY_BEHIND_TEXT } from "@/constants/Sky";
import { OTHER_TIMING, PRAYER_ID } from "@/constants/Prayer";
import { PhaseContext } from "@/contexts/PhaseContext";
import { AppLocale, AppMode } from "@/enums/app";
import { SimulatedClockContext } from "@/hooks/useTodayClock";
import i18n from "@/localization/i18n";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useAppStore } from "@/stores/app";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import type { DayPrayerTimes } from "@/types/prayerTimes";
import { controlProblems } from "@/test-helpers/controls";
import { ThemeProvider } from "@/test-helpers/theme";
import { appearancePreview } from "@/utils/appearancePreview";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@/utils/date", () => ({
  ...jest.requireActual("@/utils/date"),
  HijriNative: {
    fromTimestamp: () => ({ year: 1448, month: 4, day: 3 }),
    addDays: (date: { day: number }, days: number) => ({ ...date, day: date.day + days }),
  },
}));
jest.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: jest.fn(() => false) }));

// Only the hero reports a box, and it covers the whole sky; the rest is off it.
const mockHeroId = SKY_HERO_ID;
const mockCover = { x: 0, y: 0, width: 10_000, height: 10_000 };
jest.mock("@/utils/measureInWindow", () => ({
  measureInWindow: (view: { props?: { testID?: string } } | null) =>
    Promise.resolve(view?.props?.testID === mockHeroId ? mockCover : null),
}));

const TODAY: DayPrayerTimes = {
  date: 20260923,
  timezone: "UTC",
  timings: {
    [PRAYER_ID.FAJR]: "2026-09-23T04:00:00.000Z",
    [PRAYER_ID.DHUHR]: "2026-09-23T12:00:00.000Z",
    [PRAYER_ID.ASR]: "2026-09-23T15:00:00.000Z",
    [PRAYER_ID.MAGHRIB]: "2026-09-23T18:00:00.000Z",
    [PRAYER_ID.ISHA]: "2026-09-23T19:30:00.000Z",
  },
  otherTimings: {
    [OTHER_TIMING.SUNRISE]: "2026-09-23T06:00:00.000Z",
  } as DayPrayerTimes["otherTimings"],
};

const t = i18n.t.bind(i18n);

/** Records each change handed to the theme dissolve, then runs it. */
const mockTransition = jest.fn(async (fn: () => void | Promise<void>) => {
  await fn();
});

const renderAppearance = (phase: Phase | undefined = PHASE.ASR, clock: Date | null = null) =>
  renderRouter(
    {
      [BACK_DESTINATION.SETTINGS_THEME.route]: () => (
        <ThemeTransitionContext value={mockTransition}>
          <SimulatedClockContext value={clock}>
            <PhaseContext value={phase}>
              <AppearanceScreen />
            </PhaseContext>
          </SimulatedClockContext>
        </ThemeTransitionContext>
      ),
    },
    {
      initialUrl: BACK_DESTINATION.SETTINGS_THEME.href as string,
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
    }
  );

const rowName = (mode: AppMode) =>
  t("a11y.join", {
    first: t(`settings.themes.${mode}.title`),
    second: t(`settings.themes.${mode}.description`),
  });

const heroName = (mode: AppMode, phase: Phase | undefined) => {
  const { kicker, title, note } = appearancePreview(t, mode, NATIVE_SCHEME.LIGHT, phase);
  return t("a11y.join", { first: t("a11y.join", { first: kicker, second: title }), second: note });
};

describe("Appearance", () => {
  beforeEach(() => {
    useAppStore.setState({ locale: AppLocale.EN, mode: AppMode.ADAPTIVE });
    jest.mocked(useReducedMotion).mockReturnValue(false);
    mockTransition.mockClear();
  });

  it("draws the page sky once, the previews beside it", async () => {
    await renderAppearance();

    expect(screen.getAllByTestId(SKY_PART.CANVAS, { includeHiddenElements: true })).toHaveLength(1);
    // Three one-sky swatches, the System split and five phase bands.
    expect(screen.getAllByTestId(SKY_PART.PREVIEW, { includeHiddenElements: true })).toHaveLength(
      1 + 1 + 2 + 5
    );
  });

  it("offers the four modes in the design's order, in a named group", async () => {
    await renderAppearance();

    expect(screen.getByLabelText(t("settings.appearance"))).toHaveProp(
      "accessibilityRole",
      "radiogroup"
    );
    expect(screen.getAllByRole("radio").map((row) => row.props.accessibilityLabel)).toEqual(
      [AppMode.LIGHT, AppMode.DARK, AppMode.SYSTEM, AppMode.ADAPTIVE].map(rowName)
    );
  });

  it("marks the mode in use", async () => {
    await renderAppearance();

    expect(screen.getByRole("radio", { name: rowName(AppMode.ADAPTIVE) })).toHaveProp(
      "accessibilityState",
      expect.objectContaining({ selected: true })
    );
  });

  it("applies a mode on tap", async () => {
    await renderAppearance();

    await userEvent.setup().press(screen.getByRole("radio", { name: rowName(AppMode.DARK) }));

    await waitFor(() => expect(useAppStore.getState().mode).toBe(AppMode.DARK));
  });

  it("leaves the mode in use alone when it is tapped again", async () => {
    await renderAppearance();

    await userEvent.setup().press(screen.getByRole("radio", { name: rowName(AppMode.ADAPTIVE) }));

    expect(mockTransition).not.toHaveBeenCalled();
    expect(useAppStore.getState().mode).toBe(AppMode.ADAPTIVE);
  });

  // The whole screen changes as one picture, the sky with it.
  it("applies a mode through the theme dissolve", async () => {
    mockTransition.mockImplementationOnce(() => Promise.resolve());
    await renderAppearance();

    await userEvent.setup().press(screen.getByRole("radio", { name: rowName(AppMode.DARK) }));

    expect(mockTransition).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().mode).toBe(AppMode.ADAPTIVE);
  });

  it("reads the hero as one element naming the mode and the phase now", async () => {
    await renderAppearance(PHASE.MAGHRIB);

    expect(screen.getByLabelText(heroName(AppMode.ADAPTIVE, PHASE.MAGHRIB))).toBeOnTheScreen();
  });

  it("describes a fixed mode without the phase", async () => {
    useAppStore.setState({ mode: AppMode.LIGHT });
    await renderAppearance(PHASE.NIGHT);

    expect(screen.getByLabelText(heroName(AppMode.LIGHT, PHASE.NIGHT))).toBeOnTheScreen();
  });

  it("introduces the screen and heads the list", async () => {
    await renderAppearance();

    expect(screen.getByRole("header", { name: t("settings.themes.choose") })).toBeOnTheScreen();
    expect(screen.getByText(t("settings.themes.intro"))).toBeOnTheScreen();
  });

  it("gives every control a role, a name and a 44pt target", async () => {
    await renderAppearance();

    expect(controlProblems()).toEqual([]);
  });

  it("reads the Arabic names from the design", async () => {
    await i18n.changeLanguage(AppLocale.AR);
    useAppStore.setState({ locale: AppLocale.AR });
    await renderAppearance();

    expect(screen.getAllByRole("radio").map((row) => row.props.accessibilityLabel)).toEqual(
      [AppMode.LIGHT, AppMode.DARK, AppMode.SYSTEM, AppMode.ADAPTIVE].map(rowName)
    );
    expect(screen.getByText("تلقائي")).toBeOnTheScreen();
    expect(screen.getByText("النظام")).toBeOnTheScreen();
    await i18n.changeLanguage(AppLocale.EN);
  });

  // Jest never steps a native-driver fade; Reduce Motion sets the opacity.
  it("dims the page moon behind the hero", async () => {
    jest.mocked(useReducedMotion).mockReturnValue(true);
    usePrayerTimesStore.setState({
      todayTimings: TODAY,
      yesterdayTimings: null,
      tomorrowTimings: null,
    });
    useAppStore.setState({ mode: AppMode.DARK });
    await renderAppearance(PHASE.NIGHT);
    await act(async () => {});

    const hidden = { includeHiddenElements: true } as const;
    const page = within(screen.getByTestId(SKY_PART.CANVAS, hidden));
    expect(page.getAllByTestId(SKY_PART.MOON, hidden)).toHaveLength(1);
    expect(page.getByTestId(SKY_PART.BODIES, hidden)).toHaveStyle({
      opacity: BODY_BEHIND_TEXT.opacity,
    });
  });
});
