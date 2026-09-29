import { act, renderHook } from "@testing-library/react-native";

import { PRAYER_ID } from "@/constants/Prayer";
import { usePrayerDetail } from "@/hooks/usePrayerDetail";
import { useNotificationEditSession } from "@/hooks/useNotificationEditSession";

jest.mock("@/hooks/useNotificationEditSession", () => ({
  useNotificationEditSession: jest.fn(),
}));

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

const session = useNotificationEditSession as jest.Mock;
const lastSessionOpen = () => session.mock.lastCall?.[0];

describe("usePrayerDetail", () => {
  beforeEach(() => {
    session.mockClear();
    mockFocused = true;
  });

  it("starts with no prayer open and no edit session", async () => {
    const { result } = await renderHook(() => usePrayerDetail());

    expect(result.current.prayerId).toBeUndefined();
    expect(lastSessionOpen()).toBe(false);
  });

  it("opens a prayer and holds one edit session while it is open", async () => {
    const { result } = await renderHook(() => usePrayerDetail());

    await act(() => result.current.open(PRAYER_ID.ASR));

    expect(result.current.prayerId).toBe(PRAYER_ID.ASR);
    expect(lastSessionOpen()).toBe(true);
  });

  it("clears the prayer and ends the session on close", async () => {
    const { result } = await renderHook(() => usePrayerDetail());
    await act(() => result.current.open(PRAYER_ID.ASR));

    await act(() => result.current.close());

    expect(result.current.prayerId).toBeUndefined();
    expect(lastSessionOpen()).toBe(false);
  });

  // A row inside the sheet can open another screen; the sheet must not follow it.
  it("closes once Today loses focus", async () => {
    const { result, rerender } = await renderHook(() => usePrayerDetail());
    await act(() => result.current.open(PRAYER_ID.ASR));

    mockFocused = false;
    await rerender({});

    expect(result.current.prayerId).toBeUndefined();
    expect(lastSessionOpen()).toBe(false);
  });
});
