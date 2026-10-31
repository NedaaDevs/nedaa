import { ONBOARDING_STEP } from "@/constants/Onboarding";
import { useAppStore } from "@/stores/app";

// An in-memory store stands in for expo-sqlite's kv-store across a "restart".
const mockSaved = new Map<string, string>();
jest.mock("expo-sqlite/kv-store", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn((key: string) => Promise.resolve(mockSaved.get(key) ?? null)),
    setItem: jest.fn((key: string, value: string) => {
      mockSaved.set(key, value);
      return Promise.resolve();
    }),
    removeItem: jest.fn((key: string) => {
      mockSaved.delete(key);
      return Promise.resolve();
    }),
  },
}));

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const STORAGE_KEY = useAppStore.persist.getOptions().name ?? "";

describe("app store persistence", () => {
  beforeEach(() => mockSaved.clear());

  // The Hijri date, calendar, occasions and widget all read the offset.
  it("keeps the Hijri day offset across a restart", async () => {
    useAppStore.setState({ hijriDaysOffset: 2 });
    await settle();
    const onDisk = mockSaved.get(STORAGE_KEY);

    // A fresh launch: memory back to its defaults, the disk as it was left.
    useAppStore.setState({ hijriDaysOffset: 0 });
    await settle();
    if (onDisk) mockSaved.set(STORAGE_KEY, onDisk);
    await useAppStore.persist.rehydrate();

    expect(useAppStore.getState().hijriDaysOffset).toBe(2);
  });

  describe("a saved onboarding step", () => {
    const rehydrateWithStep = async (onboardingStep: unknown) => {
      mockSaved.set(STORAGE_KEY, JSON.stringify({ state: { onboardingStep }, version: 0 }));
      await useAppStore.persist.rehydrate();
      return useAppStore.getState().onboardingStep;
    };

    afterEach(() => useAppStore.setState({ onboardingStep: null }));

    it.each(Object.values(ONBOARDING_STEP))("keeps the known step %s", async (step) => {
      expect(await rehydrateWithStep(step)).toBe(step);
    });

    it.each([
      ["a step a later release removed", "retiredStep"],
      ["a non-string value", 3],
    ])("drops %s", async (_label, saved) => {
      useAppStore.setState({ onboardingStep: ONBOARDING_STEP.FETCH });
      expect(await rehydrateWithStep(saved)).toBeNull();
    });

    // A saved null means no step to resume; it is not a missing value.
    it("takes a saved null over the current step", async () => {
      useAppStore.setState({ onboardingStep: ONBOARDING_STEP.FETCH });
      expect(await rehydrateWithStep(null)).toBeNull();
    });

    it("keeps the current step when the saved state has none", async () => {
      useAppStore.setState({ onboardingStep: ONBOARDING_STEP.FETCH });
      mockSaved.set(STORAGE_KEY, JSON.stringify({ state: {}, version: 0 }));
      await useAppStore.persist.rehydrate();
      expect(useAppStore.getState().onboardingStep).toBe(ONBOARDING_STEP.FETCH);
    });
  });
});
