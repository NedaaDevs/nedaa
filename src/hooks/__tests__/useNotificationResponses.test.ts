import React from "react";
import renderer, { act } from "react-test-renderer";

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

// Mounts the hook as the app shell does; `ready` means "can navigate".
const Probe = ({ ready }: { ready: boolean }) => {
  useNotificationResponses(ready);
  return null;
};
const mount = (ready: boolean) => {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(React.createElement(Probe, { ready }));
  });
  return tree;
};

describe("useNotificationResponses", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLastResponse = null;
    mockListener = null;
  });

  it("acts on the tap that launched the app", () => {
    mockLastResponse = LAUNCH_TAP;
    mount(true);

    expect(mockHandle).toHaveBeenCalledWith(LAUNCH_TAP);
  });

  it("acts on later taps until it unmounts", () => {
    const tree = mount(true);
    const tap = { notification: { request: { identifier: "later" } } };
    mockListener?.(tap);

    expect(mockHandle).toHaveBeenCalledWith(tap);
    act(() => tree.unmount());
    expect(mockRemove).toHaveBeenCalled();
  });

  // Onboarding has no tabs to open; the tap waits until it finishes.
  it("waits while the app cannot navigate", () => {
    mockLastResponse = LAUNCH_TAP;
    const tree = mount(false);
    expect(mockHandle).not.toHaveBeenCalled();

    act(() => tree.update(React.createElement(Probe, { ready: true })));
    expect(mockHandle).toHaveBeenCalledWith(LAUNCH_TAP);
  });
});
