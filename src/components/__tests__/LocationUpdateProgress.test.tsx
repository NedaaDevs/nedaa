import { AccessibilityInfo, Platform, StyleSheet } from "react-native";
import { act, screen, userEvent } from "@testing-library/react-native";

import { LOCATION_UPDATE_PART, LocationUpdateProgress } from "@/components/LocationUpdateProgress";
import { ICON_SIZES } from "@/components/ui/icon/sizing";
import { DEFAULT_FACES } from "@/constants/Fonts";
import {
  LOCATION_UPDATE_SURFACE,
  UPDATE_START,
  UPDATE_STEP,
  type LocationUpdateSurface,
  type UpdateStep,
} from "@/constants/Location";
import { AppLocale, PlatformType } from "@/enums/app";
import i18n from "@/localization/i18n";
import type { UpdateRun, UpdateStart } from "@/stores/locationUpdate";
import { candidateAt } from "@/test-helpers/cityOffer";
import { PLACE } from "@/test-helpers/cityPickerStubs";
import { HAND_WRITTEN_LOCALES, type HandWrittenLocale } from "@/test-helpers/locales";
import { restingSurfaceOf } from "@/test-helpers/surface";
import { fontSizeOf, hostNodesIn, styleOf, type HostElement } from "@/test-helpers/text";
import { renderWithTheme } from "@/test-helpers/theme";

const t = i18n.t.bind(i18n);
const PLATFORM = Platform.OS;

const DEVICE_START: UpdateStart = { kind: UPDATE_START.DEVICE };

const runAt = (step: UpdateStep, failed = false, start: UpdateStart = DEVICE_START): UpdateRun => ({
  start,
  step,
  failed,
});

const renderProgress = (
  run: UpdateRun | null,
  { surface }: { surface?: LocationUpdateSurface } = {}
) => {
  const onRetry = jest.fn();
  const progress =
    surface === LOCATION_UPDATE_SURFACE.FLAT ? (
      <LocationUpdateProgress run={run} surface={surface} />
    ) : (
      <LocationUpdateProgress run={run} onRetry={onRetry} />
    );
  return renderWithTheme(progress).then(() => onRetry);
};

/** A row read with its state: done, in progress, or next. */
const row = (label: string, state: "stepDone" | "stepNow" | "stepNext") =>
  screen.getByLabelText(t(`a11y.location.update.${state}`, { step: t(label) }));

/** The width the element's icon draws at: its SVG's width. */
const drawnWidthOf = (element: HostElement) =>
  hostNodesIn(element)
    .map((node) => node.props.width)
    .find((width) => typeof width === "number");

/** Words naming the city, and words naming the person's own position. */
const PLACE_WORDS: Record<HandWrittenLocale, { place: RegExp; city: RegExp; position: RegExp }> = {
  [AppLocale.EN]: { place: /\bplace\b/i, city: /\bcity\b/i, position: /\blocation\b/i },
  [AppLocale.AR]: { place: /مكان/, city: /مدين/, position: /موقع/ },
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

    expect(row("location.update.steps.placeRow", "stepDone")).toBeTruthy();
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

    expect(row("location.update.steps.placeRow", "stepNow")).toBeTruthy();
    expect(row("location.update.steps.times", "stepNext")).toBeTruthy();
  });

  // A device read is still finding the city, in the words the hero uses for it.
  it.each([
    [UPDATE_START.DEVICE, { kind: UPDATE_START.DEVICE }, "onboarding.fetch.locatingDevice"],
    [
      UPDATE_START.ADOPT_DEVICE,
      { kind: UPDATE_START.ADOPT_DEVICE },
      "onboarding.fetch.locatingDevice",
    ],
    [
      UPDATE_START.CITY,
      { kind: UPDATE_START.CITY, city: PLACE },
      "location.update.step.findingPlace",
    ],
    [
      UPDATE_START.CANDIDATE,
      { kind: UPDATE_START.CANDIDATE, candidate: candidateAt() },
      "location.update.step.findingPlace",
    ],
  ] as const)("says a %s run's place step in its own words", async (_kind, start, status) => {
    Platform.OS = PlatformType.IOS;
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
    await renderProgress(runAt(UPDATE_STEP.LOCATION, false, start));

    expect(screen.getByLabelText(t(status))).toHaveProp("accessibilityLiveRegion", "polite");
    expect(announce).toHaveBeenCalledWith(t(status));
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

  // Inside a card the steps take the card's surface, never a second one.
  it("lies flat inside a card: no surface and no lift of its own", async () => {
    await renderProgress(runAt(UPDATE_STEP.PRAYER_TIMES), {
      surface: LOCATION_UPDATE_SURFACE.FLAT,
    });

    const frame = screen.getByTestId(LOCATION_UPDATE_PART.FRAME);
    expect(restingSurfaceOf(frame)).toBeNull();
    expect(StyleSheet.flatten(frame.props.style)?.backgroundColor).toBeUndefined();
  });

  it("says the place step as finding the place, its row as Place", async () => {
    await renderProgress(
      runAt(UPDATE_STEP.LOCATION, false, { kind: UPDATE_START.CITY, city: PLACE })
    );

    expect(screen.getByLabelText(t("location.update.step.findingPlace"))).toBeTruthy();
    expect(screen.getByText(t("location.update.steps.placeRow"))).toBeTruthy();
  });

  it("draws a stopped step flat as its words alone, for the host's Retry", async () => {
    await renderProgress(runAt(UPDATE_STEP.NOTIFICATIONS, true), {
      surface: LOCATION_UPDATE_SURFACE.FLAT,
    });

    expect(screen.getByText(t("location.update.failed.notifications"))).toBeTruthy();
    expect(screen.queryByRole("button", { name: t("common.retry") })).toBeNull();
  });

  it("says the current times stay on screen until the update finishes", async () => {
    await renderProgress(runAt(UPDATE_STEP.PRAYER_TIMES));

    expect(screen.getByText(t("location.update.keepsTimes"))).toBeTruthy();
  });

  it("sets the status at the large size", async () => {
    await renderProgress(runAt(UPDATE_STEP.PRAYER_TIMES));

    expect(screen.getByText(t("location.update.step.prayerTimes"))).toHaveStyle({
      fontSize: fontSizeOf("lg"),
    });
  });

  it("sets the steps at the body size, medium", async () => {
    await renderProgress(runAt(UPDATE_STEP.PRAYER_TIMES));

    expect(screen.getByText(t("location.update.steps.alerts"))).toHaveStyle({
      fontSize: fontSizeOf("md"),
      fontFamily: DEFAULT_FACES.medium,
    });
  });

  // A wait never spins, so Reduce Motion has nothing to stop.
  it("draws no spinner", async () => {
    await renderProgress(runAt(UPDATE_STEP.LOCATION));

    expect(JSON.stringify(screen.toJSON())).not.toMatch(/ActivityIndicator/);
  });

  // The status icon's width plus the row's gap: steps start under its text.
  it("starts the steps under the status text", async () => {
    await renderProgress(runAt(UPDATE_STEP.PRAYER_TIMES));

    const status = screen.getByLabelText(t("location.update.step.prayerTimes"));
    const inset = screen.getByTestId(LOCATION_UPDATE_PART.INSET);
    const [spacer] = inset.children;
    expect(styleOf(inset).gap).toBe(styleOf(status).gap);
    expect(typeof spacer === "string" ? null : styleOf(spacer).width).toBe(drawnWidthOf(status));
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

  // The place step names the city the update sets, not the device position.
  describe.each(HAND_WRITTEN_LOCALES)("at the place step in %s", (locale) => {
    const words = PLACE_WORDS[locale];

    beforeEach(() => act(() => i18n.changeLanguage(locale)));
    afterAll(() => i18n.changeLanguage(AppLocale.EN));

    it("names the place in its status line and its row", async () => {
      await renderProgress(
        runAt(UPDATE_STEP.LOCATION, false, { kind: UPDATE_START.CITY, city: PLACE })
      );

      expect(screen.getAllByText(words.place)).toHaveLength(2);
      expect(screen.queryAllByText(words.position)).toEqual([]);
    });

    it("names the city when it stops", async () => {
      await renderProgress(runAt(UPDATE_STEP.LOCATION, true));

      expect(screen.getByText(words.city)).toBeTruthy();
      expect(screen.queryAllByText(words.position)).toEqual([]);
    });
  });
});
