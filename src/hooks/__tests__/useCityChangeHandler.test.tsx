import { act, renderHook } from "@testing-library/react-native";

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

const renderHandler = () => renderHook(() => useCityChangeHandler());

// The update reports failure by resolving false; the modal holds the retry UI.
describe.each([
  ["update", "handleCityChangeUpdate"],
  ["retry", "retryUpdate"],
] as const)("the city-change %s", (_, action) => {
  beforeEach(() => jest.clearAllMocks());

  it("keeps the modal open when the update fails", async () => {
    mockExecuteUpdate.mockResolvedValue(false);
    const { result } = await renderHandler();

    await act(() => result.current[action]());

    expect(mockDismiss).not.toHaveBeenCalled();
  });

  it("closes the modal once the update succeeds", async () => {
    mockExecuteUpdate.mockResolvedValue(true);
    const { result } = await renderHandler();

    await act(() => result.current[action]());

    expect(mockDismiss).toHaveBeenCalledTimes(1);
  });
});
