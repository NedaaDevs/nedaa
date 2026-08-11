import { AppState } from "react-native";

import { registerForegroundReschedule } from "@/utils/foregroundReschedule";

// Referenced lazily by the module factory below, so the `mock` prefix hoisting
// rule is satisfied and the const is initialised before any test calls it.
const mockRescheduleIfNeeded = jest.fn();

jest.mock("@/stores/notification", () => ({
  useNotificationStore: {
    getState: () => ({ rescheduleIfNeeded: mockRescheduleIfNeeded }),
  },
}));

describe("registerForegroundReschedule", () => {
  it("tops up the horizon when the app becomes active, and registers only once", () => {
    const addListener = jest.spyOn(AppState, "addEventListener");

    registerForegroundReschedule();
    registerForegroundReschedule();

    expect(addListener).toHaveBeenCalledTimes(1);
    const handler = addListener.mock.calls[0][1];

    handler("active");
    expect(mockRescheduleIfNeeded).toHaveBeenCalledWith(false);

    mockRescheduleIfNeeded.mockClear();
    handler("background");
    expect(mockRescheduleIfNeeded).not.toHaveBeenCalled();
  });
});
