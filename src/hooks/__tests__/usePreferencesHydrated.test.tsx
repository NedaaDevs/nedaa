import { renderHook } from "@testing-library/react-native";

import { usePreferencesHydrated } from "@/hooks/usePreferencesHydrated";

jest.mock("expo-sqlite/kv-store", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

test("reports true once the preferences store finishes hydration", async () => {
  const { result } = await renderHook(() => usePreferencesHydrated());
  // Rendering flushes the async kv-store hydration.
  expect(result.current).toBe(true);
});
