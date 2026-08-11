import { AppState } from "react-native";

import { registerForegroundReschedule } from "@/utils/foregroundReschedule";

// Referenced lazily by the module factories below, so the `mock` prefix hoisting
// rule is satisfied and the consts are initialised before any test calls them.
const mockRescheduleIfNeeded = jest.fn();
const mockRefreshTimings = jest.fn();

jest.mock("@/stores/notification", () => ({
  useNotificationStore: {
    getState: () => ({ rescheduleIfNeeded: mockRescheduleIfNeeded }),
  },
}));
jest.mock("@/stores/prayerTimes", () => ({
  usePrayerTimesStore: {
    getState: () => ({ refreshTimingsFromDb: mockRefreshTimings }),
  },
}));

describe("registerForegroundReschedule", () => {
  it("refreshes the window before it tops up the horizon, and registers only once", async () => {
    mockRefreshTimings.mockResolvedValue([]);
    const addListener = jest.spyOn(AppState, "addEventListener");

    registerForegroundReschedule();
    registerForegroundReschedule();

    expect(addListener).toHaveBeenCalledTimes(1);
    const handler = addListener.mock.calls[0][1];

    handler("active");
    await new Promise(process.nextTick);

    expect(mockRefreshTimings).toHaveBeenCalledTimes(1);
    expect(mockRescheduleIfNeeded).toHaveBeenCalledWith(false);
    // The window refresh must precede the reschedule.
    expect(mockRefreshTimings.mock.invocationCallOrder[0]).toBeLessThan(
      mockRescheduleIfNeeded.mock.invocationCallOrder[0]
    );

    mockRefreshTimings.mockClear();
    mockRescheduleIfNeeded.mockClear();
    handler("background");
    await new Promise(process.nextTick);

    expect(mockRefreshTimings).not.toHaveBeenCalled();
    expect(mockRescheduleIfNeeded).not.toHaveBeenCalled();
  });
});
