import { SQLiteStorage } from "expo-sqlite/kv-store";

import { CITY_CHECK_STORE_KEY } from "@/constants/DB";
import { EMPTY_MEMORY, useCityCheckStore } from "@/stores/cityCheck";
import { RIYADH_ZONE } from "@/test-helpers/prayerDay";
import { toPlaceMark } from "@/utils/cityCheck/marks";

const NOW = Date.UTC(2026, 9, 29, 9);
const MARK = toPlaceMark({ latitude: 21.5433, longitude: 39.1728 }, NOW);

// The store's own database, from jest.setup.js's kv-store mock.
const storage = () => jest.mocked(SQLiteStorage).mock.results[0].value;

const saved = (cityCheck: unknown) => JSON.stringify({ state: { cityCheck }, version: 0 });

describe("city-check memory under the global kv-store mock", () => {
  it("loads the saved memory from its database", async () => {
    storage().getItem.mockResolvedValueOnce(
      saved({ lastCheckAt: NOW, lastPhoneZone: RIYADH_ZONE, kept: [MARK], notAsked: [] })
    );

    await useCityCheckStore.persist.rehydrate();

    expect(useCityCheckStore.persist.hasHydrated()).toBe(true);
    expect(storage().getItem).toHaveBeenCalledWith(CITY_CHECK_STORE_KEY);
    expect(useCityCheckStore.getState().cityCheck).toEqual({
      lastCheckAt: NOW,
      lastPhoneZone: RIYADH_ZONE,
      kept: [MARK],
      notAsked: [],
    });
  });

  it("loads a malformed record as empty", async () => {
    storage().getItem.mockResolvedValueOnce(saved({ lastCheckAt: "soon", kept: [{ lat: 1 }] }));

    await useCityCheckStore.persist.rehydrate();

    expect(useCityCheckStore.getState().cityCheck).toEqual(EMPTY_MEMORY);
  });
});
