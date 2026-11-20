import { act, renderHook } from "@testing-library/react-native";

import { usePersistHydrated } from "@/hooks/usePersistHydrated";
import { usePreferencesStore } from "@/stores/preferences";
import { holdHydration } from "@/test-helpers/hydration";

jest.mock(
  "expo-sqlite/kv-store",
  () => jest.requireActual("@/test-helpers/memoryKvStore").memoryKvStoreModule
);

describe("usePersistHydrated", () => {
  it("is false while the store reads its record, and true once the read lands", async () => {
    const hold = holdHydration(usePreferencesStore);
    const { result } = await renderHook(() => usePersistHydrated(usePreferencesStore.persist));
    expect(result.current).toBe(false);

    await act(() => hold.land());
    expect(result.current).toBe(true);
    hold.restore();
  });
});
