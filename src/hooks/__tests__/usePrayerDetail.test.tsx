import { act, renderHook } from "@testing-library/react-native";

import { PRAYER_ID } from "@/constants/Prayer";
import { usePrayerDetail } from "@/hooks/usePrayerDetail";

let mockFocused = true;
// Runs the effect while focused and its cleanup on blur, as the navigator does.
jest.mock("expo-router", () => {
  const { useEffect } = jest.requireActual("react");
  return {
    useFocusEffect: (effect: () => undefined | (() => void)) => {
      const focused = mockFocused;
      useEffect(() => (focused ? effect() : undefined), [focused, effect]);
    },
  };
});

describe("usePrayerDetail", () => {
  beforeEach(() => {
    mockFocused = true;
  });

  it("starts with no prayer open", async () => {
    const { result } = await renderHook(() => usePrayerDetail());

    expect(result.current.prayerId).toBeUndefined();
  });

  it("opens the chosen prayer", async () => {
    const { result } = await renderHook(() => usePrayerDetail());

    await act(() => result.current.open(PRAYER_ID.ASR));

    expect(result.current.prayerId).toBe(PRAYER_ID.ASR);
  });

  it("clears the prayer on close", async () => {
    const { result } = await renderHook(() => usePrayerDetail());
    await act(() => result.current.open(PRAYER_ID.ASR));

    await act(() => result.current.close());

    expect(result.current.prayerId).toBeUndefined();
  });

  // A row inside the sheet can open another screen; the sheet must not follow it.
  it("closes once Today loses focus", async () => {
    const { result, rerender } = await renderHook(() => usePrayerDetail());
    await act(() => result.current.open(PRAYER_ID.ASR));

    mockFocused = false;
    await rerender({});

    expect(result.current.prayerId).toBeUndefined();
  });
});
