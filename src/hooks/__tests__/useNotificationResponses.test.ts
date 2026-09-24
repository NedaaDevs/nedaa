import { renderHook } from "@testing-library/react-native";

import { useNotificationResponses } from "@/hooks/useNotificationResponses";

const mockHandle = jest.fn();
jest.mock("@/utils/notificationResponse", () => ({
  handleNotificationResponse: (response: unknown) => mockHandle(response),
}));

const LAUNCH_TAP = { notification: { request: { identifier: "launch" } } };
let mockLastResponse: unknown = null;
const mockRemove = jest.fn();
let mockListener: ((response: unknown) => void) | null = null;
jest.mock("expo-notifications", () => ({
  getLastNotificationResponse: () => mockLastResponse,
  clearLastNotificationResponse: jest.fn(),
  addNotificationResponseReceivedListener: (listener: (response: unknown) => void) => {
    mockListener = listener;
    return { remove: mockRemove };
  },
}));

describe("useNotificationResponses", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLastResponse = null;
    mockListener = null;
  });

  it("acts on the tap that launched the app", async () => {
    mockLastResponse = LAUNCH_TAP;
    await renderHook(() => useNotificationResponses(true));

    expect(mockHandle).toHaveBeenCalledWith(LAUNCH_TAP);
  });

  it("acts on later taps until it unmounts", async () => {
    const { unmount } = await renderHook(() => useNotificationResponses(true));
    const tap = { notification: { request: { identifier: "later" } } };
    mockListener?.(tap);

    expect(mockHandle).toHaveBeenCalledWith(tap);
    await unmount();
    expect(mockRemove).toHaveBeenCalled();
  });

  // Onboarding has no tabs to open; the tap waits until it finishes.
  it("waits while the app cannot navigate", async () => {
    mockLastResponse = LAUNCH_TAP;
    const { rerender } = await renderHook(
      ({ ready }: { ready: boolean }) => useNotificationResponses(ready),
      { initialProps: { ready: false } }
    );
    expect(mockHandle).not.toHaveBeenCalled();

    await rerender({ ready: true });
    expect(mockHandle).toHaveBeenCalledWith(LAUNCH_TAP);
  });
});
