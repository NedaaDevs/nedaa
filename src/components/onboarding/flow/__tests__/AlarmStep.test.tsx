import { AccessibilityInfo, Platform, type ViewProps } from "react-native";
import { withTiming } from "react-native-reanimated";
import { act, screen, userEvent } from "@testing-library/react-native";

import { AlarmStep } from "@/components/onboarding/flow/steps/AlarmStep";
import type { StepProps } from "@/components/onboarding/flow/types";
import {
  ALARM_PERMISSION,
  ALARM_PERMISSION_KIND,
  ALARM_PERMISSION_KINDS,
  ALARM_PERMISSION_TITLE_KEY,
  ALARM_TYPE,
  type AlarmPermissionId,
} from "@/constants/Alarm";
import { DURATION_MS } from "@/constants/Motion";
import { NATIVE_READ_TIMEOUT_MS, ONBOARDING_PART } from "@/constants/Onboarding";
import { NEDAA_LIGHT } from "@/constants/Palette";
import { AppLocale, PlatformType } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useAlarmSettingsStore } from "@/stores/alarmSettings";
import { controlProblems } from "@/test-helpers/controls";
import { clearHaptics, HAPTIC } from "@/test-helpers/hapticMock";
import { stepProps } from "@/test-helpers/onboardingStepProps";
import { later, never } from "@/test-helpers/promises";
import { renderWithTheme } from "@/test-helpers/theme";
import type { AlarmType } from "@/types/alarm";
import type { AlarmPermission } from "@/utils/alarmPermissions";
import { AppLogger } from "@/utils/appLogger";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
let mockReduced = false;
jest.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => mockReduced }));
jest.mock("@/hooks/useHaptic", () => jest.requireActual("@/test-helpers/hapticMock"));

/** The device under test: its items in order, the granted, the in-app. */
const mockDevice = {
  ids: [] as AlarmPermissionId[],
  granted: new Set<AlarmPermissionId>(),
  inApp: new Set<AlarmPermissionId>(),
};
const mockRead = jest.fn(async (): Promise<AlarmPermission[]> =>
  mockDevice.ids.map((id) => ({
    id,
    granted: mockDevice.granted.has(id),
    canRequestInApp: mockDevice.inApp.has(id),
  }))
);
const mockRequest = jest.fn(async (_permission: AlarmPermission) => {});
const mockReturns: (() => void)[] = [];
let mockActiveAt = 0;

jest.mock("@/utils/alarmPermissions", () => ({
  ...jest.requireActual("@/utils/alarmPermissions"),
  readAlarmPermissions: () => mockRead(),
  requestAlarmPermission: (permission: AlarmPermission) => mockRequest(permission),
}));
// A system screen stays open until the test returns, or the step aborts.
jest.mock("@/utils/appForeground", () => ({
  nextForeground: (_graceMs: number, signal?: AbortSignal) =>
    new Promise<void>((resolve) => {
      mockReturns.push(resolve);
      signal?.addEventListener("abort", () => resolve());
    }),
}));
jest.mock("@/hooks/useAppVisibility", () => ({
  useAppVisibility: () => ({ isActive: true, becameActiveAt: mockActiveAt }),
}));

const {
  ALARMKIT: K,
  LIVE_ACTIVITIES: L,
  NOTIFICATIONS: N,
  EXACT_ALARM: E,
  FULL_SCREEN: F,
  OVERLAY: O,
  BATTERY: B,
} = ALARM_PERMISSION;
const ANDROID = [N, E, F, O, B];
const IOS = [K, L];
const t = i18n.t.bind(i18n);
const log = AppLogger.create("alarm");

const device = (
  ids: AlarmPermissionId[],
  granted: AlarmPermissionId[],
  inApp: AlarmPermissionId[] = []
) => {
  mockDevice.ids = ids;
  mockDevice.granted = new Set(granted);
  mockDevice.inApp = new Set(inApp);
};
/** Lets every pending promise in the sequence run. */
const flush = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
const renderStep = async (type: AlarmType = ALARM_TYPE.FAJR) => {
  const props = stepProps();
  const view = await renderWithTheme(<AlarmStep {...props} type={type} />);
  await flush();
  return { props, view, type };
};
const turnOn = async () => {
  await userEvent.press(screen.getByTestId(ONBOARDING_PART.ALARM_TURN_ON));
  await flush();
};
/** Comes back from a system screen, with these items granted there. */
const returnFromSettings = async (grants: AlarmPermissionId[] = []) => {
  grants.forEach((id) => mockDevice.granted.add(id));
  await act(async () => mockReturns.shift()?.());
  await flush();
};
/** The app returns to the front while the step shows its result. */
const returnToApp = async (step: Awaited<ReturnType<typeof renderStep>>) => {
  mockActiveAt += 1;
  await step.view.rerender(<AlarmStep {...step.props} type={step.type} />);
  await flush();
};
/** Holds the next read until the returned function releases it. */
const holdNextRead = () => {
  const read = mockRead.getMockImplementation();
  const held = later();
  mockRead.mockImplementationOnce(async () => {
    await held.promise;
    return read ? read() : [];
  });
  return () => held.release();
};
const requestedIds = () => mockRequest.mock.calls.map(([permission]) => permission.id);
const enabled = (type: AlarmType) => useAlarmSettingsStore.getState()[type].enabled;
const busyCalls = (props: StepProps) => jest.mocked(props.setBusy).mock.calls;
const join = (...parts: string[]) =>
  parts.reduce((first, second) => t("a11y.join", { first, second }));
// One name per permission: the title Settings › Alarms gives it.
const label = (id: AlarmPermissionId) => t(ALARM_PERMISSION_TITLE_KEY[id]);
const isNeeded = (id: AlarmPermissionId) =>
  ALARM_PERMISSION_KINDS[id] === ALARM_PERMISSION_KIND.NEEDED;
const note = (id: AlarmPermissionId, granted: boolean) => {
  if (granted) return t(`onboarding.alarm.note.${id}.done`);
  return isNeeded(id)
    ? t(`onboarding.alarm.note.${id}.needed`)
    : t(`onboarding.alarm.note.${id}.recommended`);
};
const row = (id: AlarmPermissionId, granted: boolean) =>
  screen.getByLabelText(join(label(id), note(id, granted)));
const tick = (id: AlarmPermissionId) => screen.getByTestId(`${ONBOARDING_PART.ALARM_TICK}-${id}`);
const notOn = (id: AlarmPermissionId) => t("onboarding.alarm.notOn", { item: label(id) });
const allowed = (granted: number, total: number) =>
  t("onboarding.alarm.countA11y", { granted, total });
const card = () => screen.getByTestId(ONBOARDING_PART.ALARM_RESULT);
const segments = (testID: string) =>
  screen.queryAllByTestId(testID, { includeHiddenElements: true }).length;

beforeEach(async () => {
  await act(() => i18n.changeLanguage(AppLocale.EN));
  useAlarmSettingsStore.setState(useAlarmSettingsStore.getInitialState());
  mockRead.mockClear();
  mockRequest.mockReset().mockResolvedValue(undefined);
  mockReturns.length = 0;
  mockActiveAt = 0;
  mockReduced = false;
  clearHaptics();
  jest.mocked(withTiming).mockClear();
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe("the question", () => {
  it("asks in the body, «turn on» before «later», with the frame's Continue hidden", async () => {
    device(ANDROID, [N, E]);
    const { props } = await renderStep();

    expect(screen.getByText(t("onboarding.alarm.fajr.question"))).toBeOnTheScreen();
    expect(screen.getAllByRole("button").map((button) => button.props.accessibilityLabel)).toEqual([
      t("onboarding.alarm.turnOn"),
      t("onboarding.alarm.later"),
    ]);
    expect(jest.mocked(props.setPrimaryHidden).mock.lastCall).toEqual([true]);
    expect(props.setPrimary).not.toHaveBeenCalled();
    expect(controlProblems()).toEqual([]);

    await turnOn();
    expect(jest.mocked(props.setPrimaryHidden).mock.lastCall).toEqual([false]);
  });

  // The pressed «turn on» leaves the screen, so focus goes to the new heading.
  it("moves reader focus to the heading when the sequence starts", async () => {
    device(ANDROID, [N, E]);
    const focus = jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent");
    focus.mockImplementation(() => {}).mockClear();
    const { props } = await renderStep();
    expect(focus).not.toHaveBeenCalled();

    await turnOn();
    expect(focus).toHaveBeenCalledWith(props.headingRef.current, "focus");
    expect(screen.getByText(t("onboarding.alarm.sequence"))).toBeOnTheScreen();
  });

  it("later skips through the flow's guard, leaves the alarm off, and asks nothing", async () => {
    device(ANDROID, [N, E]);
    const { props } = await renderStep();

    await userEvent.press(screen.getByTestId(ONBOARDING_PART.ALARM_LATER));

    expect(props.onSkip).toHaveBeenCalledTimes(1);
    expect(props.onNext).not.toHaveBeenCalled();
    expect(mockRead).not.toHaveBeenCalled();
    expect(enabled(ALARM_TYPE.FAJR)).toBe(false);
  });

  it("shows both answers disabled while the first read runs", async () => {
    device(ANDROID, ANDROID);
    const release = holdNextRead();
    await renderStep();
    const disabled = (testID: string) =>
      screen.getByTestId(testID).props.accessibilityState?.disabled;
    expect(disabled(ONBOARDING_PART.ALARM_TURN_ON)).toBe(false);

    await userEvent.press(screen.getByTestId(ONBOARDING_PART.ALARM_TURN_ON));

    expect(disabled(ONBOARDING_PART.ALARM_TURN_ON)).toBe(true);
    expect(disabled(ONBOARDING_PART.ALARM_LATER)).toBe(true);
    await act(async () => release());
    await flush();
    expect(enabled(ALARM_TYPE.FAJR)).toBe(true);
  });
});

it("asks only the missing items, in order, and turns on when it can ring (Android)", async () => {
  device(ANDROID, [N, E, O]);
  await renderStep();

  await turnOn();
  expect(requestedIds()).toEqual([F]);
  await returnFromSettings();
  expect(requestedIds()).toEqual([F, B]);
  await returnFromSettings();

  expect(enabled(ALARM_TYPE.FAJR)).toBe(true);
  expect(screen.getByText(t("onboarding.alarm.done"))).toBeOnTheScreen();
});

it("keeps the alarm off and names what is missing (iOS, Live Activities off)", async () => {
  device(IOS, [K]);
  await renderStep();

  await turnOn();
  await returnFromSettings();

  expect(enabled(ALARM_TYPE.FAJR)).toBe(false);
  expect(screen.getByText(notOn(L))).toBeOnTheScreen();
  expect(screen.queryByText(t("onboarding.alarm.done"))).toBeNull();
  expect(controlProblems()).toEqual([]);
});

it("retry runs the sequence again", async () => {
  device(IOS, [K]);
  await renderStep();
  await turnOn();
  await returnFromSettings();

  await userEvent.press(screen.getByTestId(ONBOARDING_PART.ALARM_RETRY));
  await flush();
  expect(requestedIds()).toEqual([L, L]);
  await returnFromSettings([L]);

  expect(enabled(ALARM_TYPE.FAJR)).toBe(true);
});

describe("a return to the app", () => {
  it("keeps the result and the stored alarm when the read fails", async () => {
    device(IOS, IOS);
    const step = await renderStep();
    await turnOn();
    jest.spyOn(log, "w").mockImplementation(() => {});
    const setEnabled = jest.spyOn(useAlarmSettingsStore.getState(), "setEnabled");
    mockRead.mockRejectedValueOnce(new Error("alarm module down"));
    await returnToApp(step);

    expect(setEnabled).not.toHaveBeenCalled();
    expect(enabled(ALARM_TYPE.FAJR)).toBe(true);
    expect(screen.getByText(t("onboarding.alarm.done"))).toBeOnTheScreen();
  });

  it("reads the result again, and may switch the alarm on", async () => {
    device(IOS, [K]);
    const step = await renderStep();
    await turnOn();
    await returnFromSettings();

    mockDevice.granted.add(L);
    await returnToApp(step);

    expect(enabled(ALARM_TYPE.FAJR)).toBe(true);
    expect(screen.getByText(t("onboarding.alarm.done"))).toBeOnTheScreen();
  });

  it("switches the alarm off when a needed item is gone", async () => {
    device(IOS, IOS);
    const step = await renderStep();
    await turnOn();
    expect(enabled(ALARM_TYPE.FAJR)).toBe(true);

    mockDevice.granted.delete(L);
    await returnToApp(step);

    expect(enabled(ALARM_TYPE.FAJR)).toBe(false);
    expect(screen.getByText(notOn(L))).toBeOnTheScreen();
    expect(screen.queryByText(t("onboarding.alarm.done"))).toBeNull();
  });

  it("holds the frame busy while it reads", async () => {
    device(IOS, [K]);
    const step = await renderStep();
    await turnOn();
    await returnFromSettings();

    await returnToApp(step);

    expect(busyCalls(step.props)).toEqual([[true], [false], [true], [false]]);
  });
});

describe("a return to a finished step", () => {
  beforeEach(() => useAlarmSettingsStore.getState().setEnabled(ALARM_TYPE.FAJR, true));

  it("shows the result it left, not the question", async () => {
    device(IOS, IOS);
    const { props } = await renderStep();

    expect(screen.queryByTestId(ONBOARDING_PART.ALARM_TURN_ON)).toBeNull();
    expect(screen.getByText(t("onboarding.alarm.done"))).toBeOnTheScreen();
    expect(enabled(ALARM_TYPE.FAJR)).toBe(true);
    expect(busyCalls(props)).toEqual([[true], [false]]);
    expect(jest.mocked(props.setPrimaryHidden).mock.lastCall).toEqual([false]);
  });

  // The flow focuses the heading on arrival; that result read is part of it.
  it("moves no focus for the result read on arrival, only when a return changes it", async () => {
    device(ANDROID, [N, E]);
    const focus = jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent");
    focus.mockImplementation(() => {}).mockClear();
    const step = await renderStep();
    expect(card()).toBeOnTheScreen();
    expect(focus).not.toHaveBeenCalled();

    mockDevice.granted.add(B);
    await returnToApp(step);

    expect(focus).toHaveBeenCalledTimes(1);
    expect(
      (focus.mock.lastCall?.[0] as unknown as { props: ViewProps } | undefined)?.props.testID
    ).toBe(ONBOARDING_PART.ALARM_RESULT);
  });

  it("switches the alarm off when a needed item is now off", async () => {
    device(IOS, [K]);
    await renderStep();

    expect(enabled(ALARM_TYPE.FAJR)).toBe(false);
    expect(screen.getByText(notOn(L))).toBeOnTheScreen();
    // The flow's one retry wording.
    expect(screen.getByTestId(ONBOARDING_PART.ALARM_RETRY)).toHaveAccessibleName(t("common.retry"));
  });

  it("keeps the stored alarm when the read fails, and offers retry", async () => {
    jest.spyOn(log, "w").mockImplementation(() => {});
    const setEnabled = jest.spyOn(useAlarmSettingsStore.getState(), "setEnabled");
    mockRead.mockRejectedValueOnce(new Error("alarm module down"));
    device(IOS, IOS);
    await renderStep();

    expect(setEnabled).not.toHaveBeenCalled();
    expect(enabled(ALARM_TYPE.FAJR)).toBe(true);
    expect(card().props.accessibilityLabel).toBe(t("onboarding.alarm.failed"));
    expect(screen.getByTestId(ONBOARDING_PART.ALARM_RETRY)).toBeOnTheScreen();
  });
});

it("stays busy while a system screen is open, and unlocks on return", async () => {
  device(ANDROID, [N, F, O, B]);
  const { props } = await renderStep();

  await turnOn();
  expect(requestedIds()).toEqual([E]);
  expect(jest.mocked(props.setBusy).mock.lastCall).toEqual([true]);

  await returnFromSettings([E]);
  expect(jest.mocked(props.setBusy).mock.lastCall).toEqual([false]);
  expect(enabled(ALARM_TYPE.FAJR)).toBe(true);
});

it("reads an in-app prompt's answer at once", async () => {
  device(ANDROID, [E, F, O, B], [N]);
  mockRequest.mockImplementation(async ({ id }) => {
    mockDevice.granted.add(id);
  });
  await renderStep();

  await turnOn();

  expect(mockReturns).toHaveLength(0);
  expect(enabled(ALARM_TYPE.FAJR)).toBe(true);
});

it("stops at a needed item that stays missing", async () => {
  device(ANDROID, []);
  await renderStep();

  await turnOn();
  await returnFromSettings();

  expect(requestedIds()).toEqual([N]);
  expect(enabled(ALARM_TYPE.FAJR)).toBe(false);
  expect(screen.getByText(notOn(N))).toBeOnTheScreen();
});

describe("the sequence", () => {
  it("names the sequence in the heading, then the result", async () => {
    device(IOS, [K]);
    await renderStep();

    await turnOn();
    expect(screen.getByText(t("onboarding.alarm.sequence"))).toBeOnTheScreen();
    expect(screen.getByText(t("onboarding.alarm.sequenceBody"))).toBeOnTheScreen();
    expect(screen.queryByText(t("onboarding.alarm.fajr.title"))).toBeNull();

    await returnFromSettings([L]);
    expect(screen.getByText(t("onboarding.alarm.fajr.title"))).toBeOnTheScreen();
    expect(screen.queryByText(t("onboarding.alarm.sequence"))).toBeNull();
  });

  it("lists every item of the device in order, the granted ones ticked from the start", async () => {
    device(ANDROID, [N, E, O]);
    await renderStep();

    await turnOn();

    const ticks = screen.getAllByTestId(new RegExp(`^${ONBOARDING_PART.ALARM_TICK}-`));
    expect(ticks.map((view) => view.props.testID)).toEqual(
      ANDROID.map((id) => `${ONBOARDING_PART.ALARM_TICK}-${id}`)
    );
    expect(tick(N)).toHaveStyle({ backgroundColor: NEDAA_LIGHT.accentSoft.hex });
    expect(tick(F)).not.toHaveStyle({ backgroundColor: NEDAA_LIGHT.accentSoft.hex });
    expect(withTiming).not.toHaveBeenCalledWith(1, expect.anything());
  });

  it("reads each row as its name and its note, so no state is visual only", async () => {
    device(ANDROID, [N, E, O]);
    await renderStep();

    await turnOn();

    expect(row(E, true)).toBeOnTheScreen();
    expect(row(B, false)).toBeOnTheScreen();
    expect(note(B, false)).toContain(t("brand.name"));
  });

  it("reads a missing improvement as recommended, and a missing needed item as needed", async () => {
    device(ANDROID, [E, O]);
    await renderStep();

    await turnOn();

    expect(
      screen.getByLabelText(join(label(F), t("onboarding.alarm.note.fullScreen.recommended")))
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText(join(label(N), t("onboarding.alarm.note.notifications.needed")))
    ).toBeOnTheScreen();
  });

  it("outlines the item being asked, past an improvement that stayed missing", async () => {
    device(ANDROID, [N, E, O]);
    await renderStep();

    await turnOn();
    expect(row(F, false)).toHaveStyle({ borderTopWidth: 2 });
    expect(row(B, false)).toHaveStyle({ borderTopWidth: 1 });

    await returnFromSettings();
    expect(row(F, false)).toHaveStyle({ borderTopWidth: 1 });
    expect(row(B, false)).toHaveStyle({ borderTopWidth: 2 });
  });

  it("rings a needed item that stayed off in the danger colour", async () => {
    device(IOS, [K]);
    await renderStep();

    await turnOn();
    expect(tick(L)).toHaveStyle({ borderTopColor: NEDAA_LIGHT.border.hex });
    await returnFromSettings();

    expect(tick(L)).toHaveStyle({ borderTopColor: NEDAA_LIGHT.danger.hex });
    expect(tick(K)).toHaveStyle({ borderTopColor: NEDAA_LIGHT.accent.hex });
  });

  it("taps once for each grant it sees", async () => {
    device(ANDROID, [N, O]);
    await renderStep();

    await turnOn();
    await returnFromSettings([E]);
    expect(HAPTIC.light).toHaveBeenCalledTimes(1);
    await returnFromSettings();
    await returnFromSettings([B]);

    expect(HAPTIC.light).toHaveBeenCalledTimes(2);
  });
});

describe("the tick", () => {
  it("draws over 160ms on a grant", async () => {
    device(ANDROID, [N, O, B]);
    await renderStep();

    await turnOn();
    expect(withTiming).not.toHaveBeenCalledWith(1, expect.anything());
    await returnFromSettings([E]);

    expect(withTiming).toHaveBeenCalledWith(1, { duration: DURATION_MS.QUICK });
  });

  it("appears at once under Reduce Motion", async () => {
    mockReduced = true;
    device(ANDROID, [N, O, B]);
    await renderStep();

    await turnOn();
    await returnFromSettings([E]);

    expect(withTiming).not.toHaveBeenCalled();
  });
});

describe("the result body", () => {
  it("adds nothing when every item is granted", async () => {
    device(IOS, [K]);
    await renderStep();

    await turnOn();
    await returnFromSettings([L]);

    expect(enabled(ALARM_TYPE.FAJR)).toBe(true);
    expect(screen.queryByText(t("onboarding.alarm.resultBody"))).toBeNull();
    expect(card().props.accessibilityLabel).toBe(join(allowed(2, 2), t("onboarding.alarm.done")));
  });

  it("says once that the rest is in Settings when an improvement is missing", async () => {
    device(ANDROID, [N, E, O]);
    await renderStep();

    await turnOn();
    await returnFromSettings();
    await returnFromSettings();

    expect(enabled(ALARM_TYPE.FAJR)).toBe(true);
    expect(screen.getByText(t("onboarding.alarm.resultBody"))).toBeOnTheScreen();
    expect(card().props.accessibilityLabel).toBe(join(allowed(3, 5), t("onboarding.alarm.done")));
  });

  it("adds nothing when the alarm stays off", async () => {
    device(IOS, [K]);
    await renderStep();

    await turnOn();
    await returnFromSettings();

    expect(enabled(ALARM_TYPE.FAJR)).toBe(false);
    expect(screen.queryByText(t("onboarding.alarm.resultBody"))).toBeNull();
    expect(screen.getByText(notOn(L))).toBeOnTheScreen();
    expect(screen.getByTestId(ONBOARDING_PART.ALARM_RETRY)).toBeOnTheScreen();
  });
});

describe("the result card", () => {
  it("counts this device's items, with an accent card when the alarm is on", async () => {
    device(ANDROID, [N, E, O]);
    await renderStep();

    await turnOn();
    await returnFromSettings();
    await returnFromSettings();

    expect(
      screen.getByText(t("onboarding.alarm.count", { granted: 3, total: 5 }))
    ).toBeOnTheScreen();
    expect(card().props.accessibilityLabel).toBe(join(allowed(3, 5), t("onboarding.alarm.done")));
    expect(card()).toHaveStyle({
      borderTopColor: NEDAA_LIGHT.accent.hex,
      backgroundColor: NEDAA_LIGHT.accentSoft.hex,
    });
    expect(segments(ONBOARDING_PART.ALARM_BAR_ON)).toBe(3);
    expect(segments(ONBOARDING_PART.ALARM_BAR_OFF)).toBe(2);
  });

  it("drops the accent when the alarm stays off", async () => {
    device(IOS, [K]);
    await renderStep();

    await turnOn();
    await returnFromSettings();

    expect(card().props.accessibilityLabel).toBe(join(allowed(1, 2), notOn(L)));
    expect(card()).toHaveStyle({ borderTopColor: "transparent" });
    expect(card()).not.toHaveStyle({ backgroundColor: NEDAA_LIGHT.accentSoft.hex });
    // The quiet fill keeps the result framed once its accent ring is gone.
    expect(card()).toHaveStyle({ backgroundColor: NEDAA_LIGHT.surface2.hex });
    expect(screen.getByText(notOn(L))).toHaveStyle({ color: NEDAA_LIGHT.mutedSky.hex });
    expect(segments(ONBOARDING_PART.ALARM_BAR_ON)).toBe(1);
    expect(segments(ONBOARDING_PART.ALARM_BAR_OFF)).toBe(1);
  });
});

it("turns on once for a second tap while the first is still reading", async () => {
  device(ANDROID, ANDROID);
  const release = holdNextRead();
  await renderStep();

  await userEvent.press(screen.getByTestId(ONBOARDING_PART.ALARM_TURN_ON));
  await userEvent.press(screen.getByTestId(ONBOARDING_PART.ALARM_TURN_ON));
  await act(async () => release());
  await flush();

  expect(mockRead).toHaveBeenCalledTimes(1);
  expect(enabled(ALARM_TYPE.FAJR)).toBe(true);
});

it("turns Jummah on at once after the Fajr alarm is on", async () => {
  useAlarmSettingsStore.getState().setEnabled(ALARM_TYPE.FAJR, true);
  device(ANDROID, [N, E]);
  const { props } = await renderStep(ALARM_TYPE.FRIDAY);

  await turnOn();

  expect(mockRequest).not.toHaveBeenCalled();
  expect(enabled(ALARM_TYPE.FRIDAY)).toBe(true);
  expect(screen.getByText(t("onboarding.alarm.done"))).toBeOnTheScreen();
  expect(busyCalls(props)).toEqual([[true], [false]]);
});

it("works through the improvements for Jummah on its own", async () => {
  device(ANDROID, [N, E]);
  await renderStep(ALARM_TYPE.FRIDAY);

  await turnOn();

  expect(requestedIds()).toEqual([F]);
});

describe("failing closed", () => {
  let warn: jest.SpyInstance;
  beforeEach(() => {
    warn = jest.spyOn(log, "w").mockImplementation(() => {});
  });

  it("keeps the alarm off when the first read fails, and offers retry", async () => {
    mockRead.mockRejectedValueOnce(new Error("alarm module down"));
    device(IOS, IOS);
    const { props } = await renderStep();

    await turnOn();

    expect(enabled(ALARM_TYPE.FAJR)).toBe(false);
    expect(card().props.accessibilityLabel).toBe(t("onboarding.alarm.failed"));
    expect(busyCalls(props)).toEqual([[true], [false]]);
    expect(warn).toHaveBeenCalledWith("Onboarding", expect.stringContaining("alarm module down"));

    await userEvent.press(screen.getByTestId(ONBOARDING_PART.ALARM_RETRY));
    await flush();
    expect(enabled(ALARM_TYPE.FAJR)).toBe(true);
  });

  it("counts an item whose read fails after its screen as not granted", async () => {
    device(IOS, [K]);
    const { props } = await renderStep();
    await turnOn();

    mockRead.mockRejectedValueOnce(new Error("alarm module down"));
    await returnFromSettings([L]);

    expect(enabled(ALARM_TYPE.FAJR)).toBe(false);
    expect(screen.getByText(notOn(L))).toBeOnTheScreen();
    expect(jest.mocked(props.setBusy).mock.lastCall).toEqual([false]);
  });

  // A stalled read is a no: the frame unlocks and the alarm stays off.
  it("ends a read that never answers after the time limit, with the alarm off", async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    device(ANDROID, ANDROID);
    mockRead.mockReturnValueOnce(never<AlarmPermission[]>());
    const props = stepProps();
    await renderWithTheme(<AlarmStep {...props} type={ALARM_TYPE.FAJR} />);

    await user.press(screen.getByTestId(ONBOARDING_PART.ALARM_TURN_ON));
    await act(() => jest.advanceTimersByTimeAsync(NATIVE_READ_TIMEOUT_MS - 1));
    expect(busyCalls(props)).toEqual([[true]]);

    await act(() => jest.advanceTimersByTimeAsync(1));
    expect(busyCalls(props)).toEqual([[true], [false]]);
    expect(enabled(ALARM_TYPE.FAJR)).toBe(false);
    expect(card().props.accessibilityLabel).toBe(t("onboarding.alarm.failed"));
    expect(warn).toHaveBeenCalledWith(
      "Onboarding",
      expect.stringContaining(`no answer in ${NATIVE_READ_TIMEOUT_MS}ms`)
    );
  });

  it("reads an item again after its request fails", async () => {
    device(ANDROID, [E], [N]);
    mockRequest.mockRejectedValueOnce(new Error("prompt failed"));
    const { props } = await renderStep();

    await turnOn();

    expect(mockRead).toHaveBeenCalledTimes(2);
    expect(enabled(ALARM_TYPE.FAJR)).toBe(false);
    expect(screen.getByText(notOn(N))).toBeOnTheScreen();
    expect(busyCalls(props)).toEqual([[true], [false]]);
    expect(warn).toHaveBeenCalledWith("Onboarding", expect.stringContaining("prompt failed"));
  });
});

it("does nothing more once the step leaves during a system screen", async () => {
  device(IOS, [K]);
  const { props, view } = await renderStep();
  await turnOn();
  expect(requestedIds()).toEqual([L]);

  // Granted in Settings, but the step is gone before the app returns.
  mockDevice.granted.add(L);
  await act(async () => view.unmount());
  await flush();

  expect(mockRead).toHaveBeenCalledTimes(1);
  expect(enabled(ALARM_TYPE.FAJR)).toBe(false);
  expect(jest.mocked(props.setBusy).mock.lastCall).toEqual([false]);
});

describe("reading the result", () => {
  const PLATFORM = Platform.OS;
  let focus: jest.SpiedFunction<typeof AccessibilityInfo.sendAccessibilityEvent>;
  beforeEach(() => {
    jest.mocked(AccessibilityInfo.announceForAccessibility).mockClear();
    focus = jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent");
    focus.mockImplementation(() => {}).mockClear();
  });
  afterEach(() => {
    Platform.OS = PLATFORM;
  });
  /** The testID of the view that reader focus last moved to. */
  const focusedID = () =>
    (focus.mock.lastCall?.[0] as unknown as { props: ViewProps } | undefined)?.props.testID;

  // Focus reads the card on both platforms; a second voice would read it twice.
  it.each([
    [PlatformType.IOS, IOS, [K], [L]],
    [PlatformType.ANDROID, ANDROID, [N, E], []],
  ] as const)(
    "on %s, moves focus from the heading to the card once the sequence ends, and announces nothing",
    async (os, ids, granted, grantedThere) => {
      Platform.OS = os;
      device([...ids], [...granted]);
      const { props } = await renderStep();

      await turnOn();
      expect(focus).toHaveBeenLastCalledWith(props.headingRef.current, "focus");
      while (screen.queryByTestId(ONBOARDING_PART.ALARM_RESULT) === null) {
        await returnFromSettings([...grantedThere]);
      }

      expect(focusedID()).toBe(ONBOARDING_PART.ALARM_RESULT);
      expect(card().props.accessibilityLiveRegion).toBeUndefined();
      expect(AccessibilityInfo.announceForAccessibility).not.toHaveBeenCalled();
    }
  );

  it("moves focus to the card when the alarm cannot ring", async () => {
    device(IOS, []);
    await renderStep();

    await turnOn();
    await returnFromSettings();

    expect(card()).toHaveAccessibleName(join(allowed(0, 2), notOn(K)));
    expect(focusedID()).toBe(ONBOARDING_PART.ALARM_RESULT);
    expect(AccessibilityInfo.announceForAccessibility).not.toHaveBeenCalled();
  });

  it("moves focus to the card again when a return changes the result, and not otherwise", async () => {
    device(ANDROID, [N, E]);
    const step = await renderStep();
    await turnOn();
    while (screen.queryByTestId(ONBOARDING_PART.ALARM_RESULT) === null) {
      await returnFromSettings();
    }

    focus.mockClear();
    await returnToApp(step);
    expect(focus).not.toHaveBeenCalled();

    mockDevice.granted.add(B);
    await returnToApp(step);
    expect(focusedID()).toBe(ONBOARDING_PART.ALARM_RESULT);
  });
});
