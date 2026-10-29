import { UPGRADE_PATH_STATE } from "@/constants/UpgradePath";
import { useAppStore } from "@/stores/app";

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

const rehydrateWith = async (state: Record<string, unknown>) => {
  mockSaved.set(STORAGE_KEY, JSON.stringify({ state, version: 0 }));
  await useAppStore.persist.rehydrate();
  return useAppStore.getState();
};

describe("app store upgrade path", () => {
  beforeEach(() => {
    mockSaved.clear();
    useAppStore.setState({
      isFirstRun: true,
      upgradePath: UPGRADE_PATH_STATE.PENDING,
      upgradeShownThisLaunch: false,
    });
  });

  it("2.x storage without the key opens the path", async () => {
    const state = await rehydrateWith({ isFirstRun: false });
    expect(state.upgradePath).toBe(UPGRADE_PATH_STATE.PENDING);
  });

  it("finishing first-run onboarding closes the path", () => {
    useAppStore.getState().setIsFirstRun(false);
    expect(useAppStore.getState().upgradePath).toBe(UPGRADE_PATH_STATE.DONE);
  });

  it("restarting onboarding then finishing keeps it closed", () => {
    useAppStore.getState().setIsFirstRun(false);
    useAppStore.getState().restartOnboarding();
    expect(useAppStore.getState().upgradePath).toBe(UPGRADE_PATH_STATE.DONE);
    useAppStore.getState().setIsFirstRun(false);
    expect(useAppStore.getState().upgradePath).toBe(UPGRADE_PATH_STATE.DONE);
  });

  it.each(Object.values(UPGRADE_PATH_STATE))("keeps the saved state %s", async (saved) => {
    const state = await rehydrateWith({ upgradePath: saved });
    expect(state.upgradePath).toBe(saved);
  });

  it("an unknown stored value falls back to pending", async () => {
    useAppStore.setState({ upgradePath: UPGRADE_PATH_STATE.LATER });
    const state = await rehydrateWith({ upgradePath: "retiredState" });
    expect(state.upgradePath).toBe(UPGRADE_PATH_STATE.PENDING);
  });

  it("the launch flag is not persisted", async () => {
    useAppStore.getState().markUpgradeShown();
    expect(useAppStore.getState().upgradeShownThisLaunch).toBe(true);
    await settle();
    const saved = JSON.parse(mockSaved.get(STORAGE_KEY) ?? "{}");
    expect(saved.state).not.toHaveProperty("upgradeShownThisLaunch");
    expect(saved.state.upgradePath).toBe(UPGRADE_PATH_STATE.PENDING);
  });

  it("setUpgradePath stores the state", () => {
    useAppStore.getState().setUpgradePath(UPGRADE_PATH_STATE.LATER);
    expect(useAppStore.getState().upgradePath).toBe(UPGRADE_PATH_STATE.LATER);
  });
});
