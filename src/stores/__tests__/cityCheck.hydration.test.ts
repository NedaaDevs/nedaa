import { useCityCheckStore } from "@/stores/cityCheck";

// No kv-store mock of its own: this suite runs on jest.setup.js's.
describe("city-check memory under the global kv-store mock", () => {
  it("exposes persist under the global kv-store mock", () => {
    expect(useCityCheckStore.persist).toBeDefined();
    expect(() => useCityCheckStore.persist.hasHydrated()).not.toThrow();
  });
});
