import { AccessibilityInfo, Platform, StyleSheet } from "react-native";
import { act, screen, userEvent } from "@testing-library/react-native";

import { LOCATION_UPDATE_PART, LocationUpdateProgress } from "@/components/LocationUpdateProgress";
import { ICON_SIZES } from "@/components/ui/icon/sizing";
import { DEFAULT_FACES } from "@/constants/Fonts";
import { UPDATE_START, UPDATE_STEP, type UpdateStep } from "@/constants/Location";
import { NEDAA_LIGHT } from "@/constants/Palette";
import { AppLocale, PlatformType } from "@/enums/app";
import i18n from "@/localization/i18n";
import type { UpdateRun } from "@/stores/locationUpdate";
import { HAND_WRITTEN_LOCALES, type HandWrittenLocale } from "@/test-helpers/locales";
import { renderWithTheme } from "@/test-helpers/theme";

const t = i18n.t.bind(i18n);
const PLATFORM = Platform.OS;

const runAt = (step: UpdateStep, failed = false): UpdateRun => ({
  start: { kind: UPDATE_START.DEVICE },
  step,
  failed,
});

const renderProgress = (run: UpdateRun | null, { isRTL = false, inSheet = false } = {}) => {
  const onRetry = jest.fn();
  return renderWithTheme(<LocationUpdateProgress run={run} onRetry={onRetry} inSheet={inSheet} />, {
    isRTL,
  }).then(() => onRetry);
};

/** A row read with its state: done, in progress, or next. */
const row = (label: string, state: "stepDone" | "stepNow" | "stepNext") =>
  screen.getByLabelText(t(`a11y.location.update.${state}`, { step: t(label) }));

/** Words naming the city, and words naming the person's own position. */
const PLACE_WORDS: Record<HandWrittenLocale, { city: RegExp; position: RegExp }> = {
  [AppLocale.EN]: { city: /\bcity\b/i, position: /\blocation\b/i },
  [AppLocale.AR]: { city: /مدين/, position: /موقع/ },
};

afterEach(() => {
  Platform.OS = PLATFORM;
  jest.restoreAllMocks();
});

describe("LocationUpdateProgress", () => {
  it("draws nothing without a run", async () => {
    await renderProgress(null);

    expect(screen.queryByTestId(LOCATION_UPDATE_PART.STEPS)).toBeNull();
  });

  it("marks the place found, the times running and notifications next", async () => {
    await renderProgress(runAt(UPDATE_STEP.PRAYER_TIMES));

    expect(row("location.update.steps.place", "stepDone")).toBeTruthy();
    expect(row("location.update.steps.times", "stepNow")).toBeTruthy();
    expect(row("location.update.steps.alerts", "stepNext")).toBeTruthy();
  });

  it.each([UPDATE_STEP.NOTIFICATIONS, UPDATE_STEP.ALARMS])(
    "shows the %s step on the last row",
    async (step) => {
      await renderProgress(runAt(step));

      expect(row("location.update.steps.times", "stepDone")).toBeTruthy();
      expect(row("location.update.steps.alerts", "stepNow")).toBeTruthy();
    }
  );

  it("starts with every row after the place still next", async () => {
    await renderProgress(runAt(UPDATE_STEP.LOCATION));

    expect(row("location.update.steps.place", "stepNow")).toBeTruthy();
    expect(row("location.update.steps.times", "stepNext")).toBeTruthy();
  });

  // The page is not a live region: only the line naming the step is read.
  it("announces the step's status line and nothing else", async () => {
    Platform.OS = PlatformType.IOS;
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
    await renderProgress(runAt(UPDATE_STEP.PRAYER_TIMES));

    const status = t("location.update.step.prayerTimes");
    expect(screen.getByLabelText(status)).toHaveProp("accessibilityLiveRegion", "polite");
    expect(announce).toHaveBeenCalledWith(status);
    expect(JSON.stringify(screen.toJSON()).match(/"accessibilityLiveRegion"/g)).toHaveLength(1);
  });

  // Weight 700 is for display and title text; body text tops out at 600.
  it("sets the status and the step in progress at 600", async () => {
    await renderProgress(runAt(UPDATE_STEP.PRAYER_TIMES));

    expect(screen.getByText(t("location.update.step.prayerTimes"))).toHaveStyle({
      fontFamily: DEFAULT_FACES.semibold,
    });
    expect(screen.getByText(t("location.update.steps.times"))).toHaveStyle({
      fontFamily: DEFAULT_FACES.semibold,
    });
  });

  // One mark width, so the labels line up and stay put as the run moves on.
  it("gives every step's mark the icons' width", async () => {
    await renderProgress(runAt(UPDATE_STEP.PRAYER_TIMES));

    const marks = screen.getAllByTestId(LOCATION_UPDATE_PART.MARK, { includeHiddenElements: true });
    expect(marks).toHaveLength(3);
    marks.forEach((mark) => expect(mark).toHaveStyle({ width: ICON_SIZES.xs }));
  });

  // A sheet stacks two tones and never lays glass on glass.
  it("lies flat on the panel tone inside a sheet", async () => {
    await renderProgress(runAt(UPDATE_STEP.PRAYER_TIMES), { inSheet: true });

    const frame = screen.getByTestId(LOCATION_UPDATE_PART.FRAME);
    expect(frame).toHaveStyle({ backgroundColor: NEDAA_LIGHT.panel.hex });
    expect(StyleSheet.flatten(frame.props.style).boxShadow).toBeUndefined();
  });

  it("says the current times stay on screen until the update finishes", async () => {
    await renderProgress(runAt(UPDATE_STEP.PRAYER_TIMES));

    expect(screen.getByText(t("location.update.keepsTimes"))).toBeTruthy();
  });

  // A wait never spins, so Reduce Motion has nothing to stop.
  it("draws no spinner", async () => {
    await renderProgress(runAt(UPDATE_STEP.LOCATION));

    expect(JSON.stringify(screen.toJSON())).not.toMatch(/ActivityIndicator/);
  });

  it("sets the rows in from the start edge, the same in Arabic", async () => {
    await renderProgress(runAt(UPDATE_STEP.PRAYER_TIMES), { isRTL: true });

    const style = StyleSheet.flatten(screen.getByTestId(LOCATION_UPDATE_PART.STEPS).props.style);
    expect(style.paddingStart).toBeGreaterThan(0);
    expect(style.paddingLeft).toBeUndefined();
  });

  it.each([
    [UPDATE_STEP.LOCATION, "location.update.failed.location"],
    [UPDATE_STEP.PRAYER_TIMES, "location.update.failed.prayerTimes"],
    [UPDATE_STEP.NOTIFICATIONS, "location.update.failed.notifications"],
    [UPDATE_STEP.ALARMS, "location.update.failed.alarms"],
  ] as const)("says what stopped at the %s step, with a retry", async (step, copy) => {
    Platform.OS = PlatformType.IOS;
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
    const onRetry = await renderProgress(runAt(step, true));

    expect(screen.getByLabelText(t(copy))).toBeTruthy();
    expect(announce).toHaveBeenCalledWith(t(copy));
    expect(screen.queryByTestId(LOCATION_UPDATE_PART.STEPS)).toBeNull();
    await userEvent.press(screen.getByRole("button", { name: t("common.retry") }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  // A step naming "your location" reads as tracking the person, not the city.
  describe.each(HAND_WRITTEN_LOCALES)("at the place step in %s", (locale) => {
    const words = PLACE_WORDS[locale];

    beforeEach(() => act(() => i18n.changeLanguage(locale)));
    afterAll(() => i18n.changeLanguage(AppLocale.EN));

    it("names the city in its status line and its row", async () => {
      await renderProgress(runAt(UPDATE_STEP.LOCATION));

      expect(screen.getAllByText(words.city)).toHaveLength(2);
      expect(screen.queryAllByText(words.position)).toEqual([]);
    });

    it("names the city when it stops", async () => {
      await renderProgress(runAt(UPDATE_STEP.LOCATION, true));

      expect(screen.getByText(words.city)).toBeTruthy();
      expect(screen.queryAllByText(words.position)).toEqual([]);
    });
  });
});
