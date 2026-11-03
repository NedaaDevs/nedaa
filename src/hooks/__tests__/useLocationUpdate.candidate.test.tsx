import { AccessibilityInfo } from "react-native";
import { act, renderHook } from "@testing-library/react-native";

import { RUN_END, STEP_OUTCOME } from "@/constants/Location";
import { useLocationUpdate } from "@/hooks/useLocationUpdate";
import { useLocationStore } from "@/stores/location";
import { useLocationUpdateStore } from "@/stores/locationUpdate";
import { candidateAt } from "@/test-helpers/cityOffer";

const mockApplyCandidate = jest.fn();
const mockLoadTimes = jest.fn();
const mockSchedule = jest.fn();

jest.mock("expo-widget", () => ({ reloadPrayerWidgets: jest.fn() }));
jest.mock("@/stores/prayerTimes", () => ({
  usePrayerTimesStore: {
    getState: () => ({ loadPrayerTimesAtCurrentPlace: mockLoadTimes }),
  },
}));
jest.mock("@/stores/notification", () => ({
  useNotificationStore: { getState: () => ({ scheduleAllNotifications: mockSchedule }) },
}));
jest.mock("@/utils/alarmScheduler", () => ({
  rescheduleAllAlarms: jest.fn(
    async () => jest.requireActual("@/constants/Location").STEP_OUTCOME.DONE
  ),
}));

beforeEach(() => {
  jest.clearAllMocks();
  useLocationUpdateStore.setState({ run: null });
  useLocationStore.setState({ applyCityCandidate: mockApplyCandidate });
  mockLoadTimes.mockResolvedValue(true);
  mockSchedule.mockResolvedValue({ success: true, scheduledCount: 5 });
});

describe("applyCandidate", () => {
  it("resolves the run's result, outcomes included, and says it landed", async () => {
    mockApplyCandidate.mockResolvedValue(true);
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
    const { result } = await renderHook(() => useLocationUpdate());
    let ended;
    await act(async () => {
      ended = await result.current.applyCandidate(candidateAt());
    });
    expect(ended).toMatchObject({ end: RUN_END.LANDED });
    expect(ended).toHaveProperty("outcomes");
    expect(announce).toHaveBeenCalledTimes(1);
  });

  it("resolves a stopped result, and says nothing, when the place moved", async () => {
    mockApplyCandidate.mockResolvedValue(false);
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
    const { result } = await renderHook(() => useLocationUpdate());
    let ended;
    await act(async () => {
      ended = await result.current.applyCandidate(candidateAt());
    });
    expect(ended).toMatchObject({ end: RUN_END.STOPPED });
    expect(announce).not.toHaveBeenCalled();
  });

  it("keeps the notifications outcome for the card", async () => {
    mockApplyCandidate.mockResolvedValue(true);
    const { result } = await renderHook(() => useLocationUpdate());
    let ended;
    await act(async () => {
      ended = await result.current.applyCandidate(candidateAt());
    });
    expect(ended).toMatchObject({
      outcomes: expect.objectContaining({ notifications: STEP_OUTCOME.DONE }),
    });
  });
});
