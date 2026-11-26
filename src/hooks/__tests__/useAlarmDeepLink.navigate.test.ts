import { ACTIVE_ALARM_SOURCE, ALARM_SCREEN_PATH, ALARM_TYPE } from "@/constants/Alarm";
import {
  navigateToAlarm,
  openAlarmOnRequest,
  setAlarmScreenActive,
} from "@/hooks/useAlarmDeepLink";

const mockReplace = jest.fn();
const mockUsesNativeOverlay = jest.fn(() => false);
const mockIsOverlayShowing = jest.fn(() => false);
jest.mock("expo-router", () => ({ router: { replace: (to: unknown) => mockReplace(to) } }));
jest.mock("expo-alarm", () => ({
  ...jest.requireActual("expo-alarm"),
  usesNativeOverlay: () => mockUsesNativeOverlay(),
  isOverlayShowing: () => mockIsOverlayShowing(),
}));
jest.mock("@/utils/alarmScheduler", () => ({
  completeAndRescheduleAlarm: jest.fn(),
  waitForAlarmStores: jest.fn(),
}));
jest.mock("@/utils/activeAlarmDetector", () => ({ detectActiveAlarm: jest.fn(async () => null) }));
jest.mock("@/utils/alarmReport", () => ({ alarmLog: { e: jest.fn() } }));

const SOURCE = ACTIVE_ALARM_SOURCE.PAST_DUE;
// Past the navigation debounce, so each case starts unguarded.
const DEBOUNCE_GAP_MS = 60_000;
let clock = Date.now();
let alarmNumber = 0;

const nextAlarmId = () => {
  alarmNumber += 1;
  return `alarm-${alarmNumber}`;
};
const navigate = () => navigateToAlarm(nextAlarmId(), ALARM_TYPE.FAJR, SOURCE);
const request = () => openAlarmOnRequest(nextAlarmId(), ALARM_TYPE.FAJR);
const passTheDebounce = () => {
  clock += DEBOUNCE_GAP_MS;
  jest.spyOn(Date, "now").mockReturnValue(clock);
};

// The expo-alarm reads are mocked, so the platform plays no part here;
// androidReads.test.ts covers what iOS answers.
beforeEach(() => {
  passTheDebounce();
  setAlarmScreenActive(null);
  mockReplace.mockClear();
  mockUsesNativeOverlay.mockReset().mockReturnValue(false);
  mockIsOverlayShowing.mockReset().mockReturnValue(false);
});
afterEach(() => jest.restoreAllMocks());

describe("navigateToAlarm", () => {
  it("stands down with the overlay permission, even with no overlay showing", () => {
    mockUsesNativeOverlay.mockReturnValue(true);

    expect(navigate()).toBe(false);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("opens the alarm screen without the overlay permission", () => {
    expect(navigate()).toBe(true);
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: ALARM_SCREEN_PATH.RING,
      params: { alarmId: `alarm-${alarmNumber}`, alarmType: ALARM_TYPE.FAJR },
    });
  });

  it("does not replace the route twice within the debounce", () => {
    expect(navigate()).toBe(true);
    expect(navigate()).toBe(false);
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });

  it("does not open over a mounted alarm screen", () => {
    setAlarmScreenActive("alarm-on-screen");
    passTheDebounce();

    expect(navigate()).toBe(false);
  });
});

describe("openAlarmOnRequest", () => {
  it("opens the alarm screen with the overlay permission and no overlay showing", () => {
    mockUsesNativeOverlay.mockReturnValue(true);

    expect(request()).toBe(true);
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: ALARM_SCREEN_PATH.RING,
      params: { alarmId: `alarm-${alarmNumber}`, alarmType: ALARM_TYPE.FAJR },
    });
  });

  it("leaves a showing overlay on screen", () => {
    mockUsesNativeOverlay.mockReturnValue(true);
    mockIsOverlayShowing.mockReturnValue(true);

    expect(request()).toBe(false);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("does not replace the route twice within the debounce", () => {
    expect(request()).toBe(true);
    expect(request()).toBe(false);
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });

  // The route can redirect before the alarm screen mounts.
  it("opens again once the debounce passes when no alarm screen mounted", () => {
    expect(request()).toBe(true);
    passTheDebounce();

    expect(request()).toBe(true);
    expect(mockReplace).toHaveBeenCalledTimes(2);
  });
});
