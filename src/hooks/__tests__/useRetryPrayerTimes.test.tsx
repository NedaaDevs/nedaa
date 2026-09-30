import { act, renderHook } from "@testing-library/react-native";

import { useRetryPrayerTimes } from "@/hooks/useRetryPrayerTimes";
import { usePrayerTimesStore } from "@/stores/prayerTimes";

const clearError = jest.fn();

describe("useRetryPrayerTimes", () => {
  beforeEach(() => jest.clearAllMocks());

  it("clears the error, then reloads the times from the source", async () => {
    const loadPrayerTimes = jest.fn(() => Promise.resolve());
    usePrayerTimesStore.setState({ clearError, loadPrayerTimes });
    const { result } = await renderHook(() => useRetryPrayerTimes());

    await act(async () => result.current());

    expect(clearError.mock.invocationCallOrder[0]).toBeLessThan(
      loadPrayerTimes.mock.invocationCallOrder[0]
    );
    expect(loadPrayerTimes).toHaveBeenCalledWith(true);
  });
});
