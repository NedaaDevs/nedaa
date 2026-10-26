import { AccessibilityInfo, Platform } from "react-native";
import { act, screen, userEvent, waitFor } from "@testing-library/react-native";
import { PermissionStatus } from "expo-notifications";

import { NotificationsStep } from "@/components/onboarding/flow/steps/NotificationsStep";
import { FOCUS_COUNTDOWN_PART } from "@/components/today/FocusCountdown";
import { NOTIFICATION_TYPE } from "@/constants/Notification";
import { ONBOARDING_PART } from "@/constants/Onboarding";
import { AppLocale, PlatformType } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useNotificationStore } from "@/stores/notification";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { controlProblems } from "@/test-helpers/controls";
import { lastPrimary, stepProps } from "@/test-helpers/onboardingStepProps";
import { RIYADH_DAY, riyadhAt } from "@/test-helpers/prayerDay";
import { renderWithTheme } from "@/test-helpers/theme";
import { AppLogger } from "@/utils/appLogger";
import { requestNotificationPermission } from "@/utils/notifications";
import { getPreviewSource, soundPreviewManager } from "@/utils/sound";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => false }));
jest.mock("@/utils/notifications", () => ({
  ...jest.requireActual("@/utils/notifications"),
  requestNotificationPermission: jest.fn(),
}));

// jest-expo gives every audio file the value 1, so only a distinct value for
// this file shows which sound the step plays.
jest.mock("@/assets/sounds/makkah_athan1.mp3", () => 4242);
const MAKKAH_ATHAN_SAMPLE = jest.requireMock<number>("@/assets/sounds/makkah_athan1.mp3");

const mockPlay = jest.fn<Promise<void>, [string | number]>(() => Promise.resolve());
const mockStop = jest.fn(() => Promise.resolve());
jest.mock("@/services/audio/previewPlayer", () => ({
  playPreview: (source: string | number) => mockPlay(source),
  stopPreview: () => mockStop(),
  addPreviewListener: () => () => {},
}));

const t = i18n.t.bind(i18n);
const mockRequest = jest.mocked(requestNotificationPermission);

beforeEach(async () => {
  await act(() => i18n.changeLanguage(AppLocale.EN));
  mockRequest.mockReset().mockResolvedValue({ status: PermissionStatus.DENIED });
  soundPreviewManager.forceReset();
  mockPlay.mockClear();
  mockStop.mockClear();
  usePrayerTimesStore.setState({
    yesterdayTimings: null,
    todayTimings: null,
    tomorrowTimings: null,
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

it("asks the question, explains the card and offers to allow", async () => {
  const props = stepProps();
  await renderWithTheme(<NotificationsStep {...props} />);

  expect(screen.getByText(t("onboarding.notifications.question"))).toBeOnTheScreen();
  expect(screen.getByText(t("onboarding.notifications.card"))).toBeOnTheScreen();
  expect(lastPrimary(props.setPrimary)?.label).toBe(
    t("onboarding.notifications.allowNotifications")
  );
  expect(screen.queryByTestId(ONBOARDING_PART.NOTIFICATIONS_DENIED)).toBeNull();
  expect(controlProblems()).toEqual([]);
});

it("shows Today's countdown under the card once times are stored", async () => {
  jest.useFakeTimers({ now: new Date(riyadhAt("10:00")) });
  usePrayerTimesStore.setState({ todayTimings: RIYADH_DAY });
  await renderWithTheme(<NotificationsStep {...stepProps()} />);

  expect(screen.getByTestId(FOCUS_COUNTDOWN_PART.ROW)).toBeOnTheScreen();
});

it("shows no countdown while no times are stored", async () => {
  await renderWithTheme(<NotificationsStep {...stepProps()} />);

  expect(screen.queryByTestId(FOCUS_COUNTDOWN_PART.ROW)).toBeNull();
});

it("advances once notifications are allowed", async () => {
  mockRequest.mockResolvedValue({ status: PermissionStatus.GRANTED });
  const props = stepProps();
  await renderWithTheme(<NotificationsStep {...props} />);

  await act(async () => lastPrimary(props.setPrimary)?.onPress());

  expect(props.onNext).toHaveBeenCalledTimes(1);
  expect(jest.mocked(props.setBusy).mock.calls).toEqual([[true], [false]]);
});

// An undetermined answer is no grant either.
it.each([PermissionStatus.DENIED, PermissionStatus.UNDETERMINED])(
  "says so when the answer is %s and waits for Continue",
  async (status) => {
    jest.useFakeTimers();
    mockRequest.mockResolvedValue({ status });
    const props = stepProps();
    await renderWithTheme(<NotificationsStep {...props} />);

    await act(async () => lastPrimary(props.setPrimary)?.onPress());
    await act(() => jest.advanceTimersByTimeAsync(10_000));

    expect(screen.getByTestId(ONBOARDING_PART.NOTIFICATIONS_DENIED)).toHaveTextContent(
      t("onboarding.notifications.deniedBody")
    );
    expect(props.onNext).not.toHaveBeenCalled();
    expect(lastPrimary(props.setPrimary)).toBeNull();
    expect(jest.mocked(props.setBusy).mock.calls).toEqual([[true], [false]]);
  }
);

it("treats a failed request as a denial and logs it", async () => {
  const warn = jest.spyOn(AppLogger.create("notifications"), "w").mockImplementation(() => {});
  mockRequest.mockRejectedValue(new Error("permission service down"));
  const props = stepProps();
  await renderWithTheme(<NotificationsStep {...props} />);

  await act(async () => lastPrimary(props.setPrimary)?.onPress());

  expect(screen.getByTestId(ONBOARDING_PART.NOTIFICATIONS_DENIED)).toHaveTextContent(
    t("onboarding.notifications.deniedBody")
  );
  expect(props.onNext).not.toHaveBeenCalled();
  expect(lastPrimary(props.setPrimary)).toBeNull();
  expect(jest.mocked(props.setBusy).mock.calls).toEqual([[true], [false]]);
  expect(warn).toHaveBeenCalledWith(
    "Onboarding",
    expect.stringContaining("permission service down")
  );
});

describe("speaking the denial", () => {
  const PLATFORM = Platform.OS;
  beforeEach(() => jest.mocked(AccessibilityInfo.announceForAccessibility).mockClear());
  afterEach(() => {
    Platform.OS = PLATFORM;
  });

  // Android speaks the live region; iOS has none, so the step says it.
  it("says it on iOS once the answer comes, and not before", async () => {
    Platform.OS = PlatformType.IOS;
    const props = stepProps();
    await renderWithTheme(<NotificationsStep {...props} />);
    expect(AccessibilityInfo.announceForAccessibility).not.toHaveBeenCalled();

    await act(async () => lastPrimary(props.setPrimary)?.onPress());

    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledTimes(1);
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
      t("onboarding.notifications.deniedBody")
    );
  });

  it("leaves Android to its live region", async () => {
    Platform.OS = PlatformType.ANDROID;
    const props = stepProps();
    await renderWithTheme(<NotificationsStep {...props} />);

    await act(async () => lastPrimary(props.setPrimary)?.onPress());

    expect(
      screen.getByTestId(ONBOARDING_PART.NOTIFICATIONS_DENIED).props.accessibilityLiveRegion
    ).toBe("polite");
    expect(AccessibilityInfo.announceForAccessibility).not.toHaveBeenCalled();
  });
});

it("asks once on a double tap", async () => {
  const props = stepProps();
  await renderWithTheme(<NotificationsStep {...props} />);
  const primary = lastPrimary(props.setPrimary);

  await act(async () => {
    primary?.onPress();
    primary?.onPress();
  });

  expect(mockRequest).toHaveBeenCalledTimes(1);
});

describe("the Focus line", () => {
  const PLATFORM = Platform.OS;
  afterEach(() => {
    Platform.OS = PLATFORM;
  });

  it("tells iOS users the athan comes through a Focus", async () => {
    Platform.OS = PlatformType.IOS;
    await renderWithTheme(<NotificationsStep {...stepProps()} />);

    expect(screen.getByText(t("onboarding.notifications.focusNote"))).toBeOnTheScreen();
  });

  it("is not shown on Android", async () => {
    Platform.OS = PlatformType.ANDROID;
    await renderWithTheme(<NotificationsStep {...stepProps()} />);

    expect(screen.queryByText(t("onboarding.notifications.focusNote"))).toBeNull();
  });
});

describe("the athan sample", () => {
  const user = userEvent.setup();
  const hear = () => screen.getByRole("button", { name: t("onboarding.notifications.hearAthan") });
  const stop = () => screen.getByRole("button", { name: t("onboarding.notifications.stopAthan") });

  it("waits to be asked", async () => {
    await renderWithTheme(<NotificationsStep {...stepProps()} />);

    expect(hear()).toBeOnTheScreen();
    expect(mockPlay).not.toHaveBeenCalled();
  });

  it("plays the athan a new install uses, and stops on a second press", async () => {
    const newInstallAthan = getPreviewSource(
      NOTIFICATION_TYPE.PRAYER,
      useNotificationStore.getInitialState().settings.defaults.prayer.sound
    );
    await renderWithTheme(<NotificationsStep {...stepProps()} />);

    await user.press(hear());
    expect(mockPlay).toHaveBeenCalledWith(newInstallAthan);
    // Other audio files share the value 1; this pins the match to one file.
    expect(newInstallAthan).toBe(MAKKAH_ATHAN_SAMPLE);

    await user.press(stop());
    expect(mockStop).toHaveBeenCalledTimes(1);
    expect(hear()).toBeOnTheScreen();
  });

  it("stops when the step is left", async () => {
    await renderWithTheme(<NotificationsStep {...stepProps()} />);
    await user.press(hear());

    await screen.unmount();

    await waitFor(() => expect(mockStop).toHaveBeenCalledTimes(1));
  });
});
