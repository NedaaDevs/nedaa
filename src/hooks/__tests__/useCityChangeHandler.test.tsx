import React from "react";
import renderer, { act } from "react-test-renderer";

import { useCityChangeHandler } from "@/hooks/useCityChangeHandler";

const mockExecuteUpdate = jest.fn();
const mockDismiss = jest.fn();

jest.mock("@/hooks/useLocationUpdate", () => ({
  useLocationUpdate: () => ({
    updateState: { isUpdating: false, currentStep: null, error: null },
    executeUpdate: mockExecuteUpdate,
    retry: jest.fn(),
  }),
}));

jest.mock("@/stores/location", () => ({
  useLocationStore: () => ({
    showCityChangeModal: true,
    pendingCityChange: null,
    dismissCityChangeModal: mockDismiss,
    checkAndPromptCityChange: jest.fn(),
  }),
}));

const renderHandler = () => {
  let handler!: ReturnType<typeof useCityChangeHandler>;
  const Probe = () => {
    handler = useCityChangeHandler();
    return null;
  };
  act(() => {
    renderer.create(<Probe />);
  });
  return handler;
};

// The update reports failure by resolving false; the modal holds the retry UI.
describe.each([
  ["update", "handleCityChangeUpdate"],
  ["retry", "retryUpdate"],
] as const)("the city-change %s", (_, action) => {
  beforeEach(() => jest.clearAllMocks());

  it("keeps the modal open when the update fails", async () => {
    mockExecuteUpdate.mockResolvedValue(false);
    const handler = renderHandler();

    await act(async () => {
      await handler[action]();
    });

    expect(mockDismiss).not.toHaveBeenCalled();
  });

  it("closes the modal once the update succeeds", async () => {
    mockExecuteUpdate.mockResolvedValue(true);
    const handler = renderHandler();

    await act(async () => {
      await handler[action]();
    });

    expect(mockDismiss).toHaveBeenCalledTimes(1);
  });
});
