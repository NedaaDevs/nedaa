import { renderHook } from "@testing-library/react-native";

import { UPDATE_START, UPDATE_STEP } from "@/constants/Location";
import { usePlaceHandOver } from "@/hooks/usePlaceHandOver";
import { useLocationUpdateStore } from "@/stores/locationUpdate";
import { MAKKAH_CITY, RIYADH_CITY } from "@/test-helpers/place";

const mockApply = jest.fn(async () => true);
const mockDismiss = jest.fn();
const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ dismiss: mockDismiss, replace: mockReplace }),
  useNavigation: () => ({ getState: () => ({ routes: [], index: 0 }) }),
}));
jest.mock("@/hooks/useLocationUpdate", () => ({
  useLocationUpdate: () => ({ applyManualLocation: mockApply }),
}));

describe("usePlaceHandOver", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useLocationUpdateStore.setState({ run: null });
  });

  it("starts the city's update and leaves the picker", async () => {
    const { result } = await renderHook(() => usePlaceHandOver());

    result.current(MAKKAH_CITY);

    expect(mockApply).toHaveBeenCalledWith(MAKKAH_CITY);
    expect(mockReplace).toHaveBeenCalled();
  });

  // The run would refuse the city; the picker stays open on it.
  it("keeps the picker while another update runs", async () => {
    useLocationUpdateStore.setState({
      run: {
        start: { kind: UPDATE_START.CITY, city: RIYADH_CITY },
        step: UPDATE_STEP.PRAYER_TIMES,
        failed: false,
      },
    });
    const { result } = await renderHook(() => usePlaceHandOver());

    result.current(MAKKAH_CITY);

    expect(mockApply).not.toHaveBeenCalled();
    expect(mockDismiss).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
