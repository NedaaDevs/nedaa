let mockSaved: string | null = null;
const mockSetItem = jest.fn(async (_key: string, _value: string) => {});

jest.mock("@/services/widgetSnapshot", () => ({ syncWidgetSnapshot: jest.fn(async () => {}) }));
jest.mock("@/services/athkar-db", () => ({
  AthkarDB: {
    initialize: jest.fn(async () => {}),
    initializeDailyItems: jest.fn(async () => true),
    getSessionItems: jest.fn(async () => []),
    isSessionCompleted: jest.fn(async () => false),
    areBothSessionsCompleted: jest.fn(async () => false),
    getStreakData: jest.fn(async () => null),
  },
}));
jest.mock("@/stores/location", () => ({
  __esModule: true,
  default: { getState: () => ({ locationDetails: { timezone: "Asia/Riyadh" } }) },
}));
jest.mock("expo-sqlite/kv-store", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => mockSaved),
    setItem: (key: string, value: string) => mockSetItem(key, value),
    removeItem: jest.fn(async () => {}),
  },
}));
jest.mock("@/utils/appLogger", () => ({
  AppLogger: { create: () => ({ i: jest.fn(), w: jest.fn(), e: jest.fn() }) },
}));

/* eslint-disable import/first -- imports must follow jest.mock hoisting */
import { ATHKAR_GROUP_ORDER } from "@/constants/Athkar";
import { useAthkarStore } from "@/stores/athkar";
/* eslint-enable import/first */

const DEFAULTS = useAthkarStore.getState().settings;

const order = () => useAthkarStore.getState().settings.groupOrder;

/** Loads the store, holding `held`, from a saved record with these settings. */
const rehydrate = async (saved: object | undefined, held = DEFAULTS) => {
  const state = saved === undefined ? {} : { settings: saved };
  mockSaved = JSON.stringify({ state, version: 0 });
  useAthkarStore.setState({ settings: held });
  await useAthkarStore.persist.rehydrate();
};

describe("the stored group order", () => {
  it("is by round before a person chooses", () =>
    expect(DEFAULTS.groupOrder).toBe(ATHKAR_GROUP_ORDER.BY_ROUND));

  it("reads by round from a record saved before the setting", async () => {
    const held = { ...DEFAULTS, groupOrder: ATHKAR_GROUP_ORDER.EACH_IN_FULL };
    await rehydrate({ autoMoveToNext: false, showStreak: true, showTranslation: false }, held);

    expect(order()).toBe(ATHKAR_GROUP_ORDER.BY_ROUND);
    expect(useAthkarStore.getState().settings.autoMoveToNext).toBe(false);
  });

  it("reads by round from a record with no settings", async () => {
    await rehydrate(undefined, { ...DEFAULTS, groupOrder: ATHKAR_GROUP_ORDER.EACH_IN_FULL });

    expect(order()).toBe(ATHKAR_GROUP_ORDER.BY_ROUND);
  });

  it("keeps a saved order", async () => {
    await rehydrate({ ...DEFAULTS, groupOrder: ATHKAR_GROUP_ORDER.EACH_IN_FULL });

    expect(order()).toBe(ATHKAR_GROUP_ORDER.EACH_IN_FULL);
  });

  it.each(["an-order-this-build-lacks", 3, {}])(
    "reads the unknown order %p as by round",
    async (saved) => {
      await rehydrate({ ...DEFAULTS, groupOrder: saved });

      expect(order()).toBe(ATHKAR_GROUP_ORDER.BY_ROUND);
    }
  );

  it("stores a chosen order and keeps the other settings", async () => {
    const before = { ...DEFAULTS, showTranslation: !DEFAULTS.showTranslation };
    useAthkarStore.setState({ settings: before });
    mockSetItem.mockClear();

    useAthkarStore.getState().setGroupOrder(ATHKAR_GROUP_ORDER.EACH_IN_FULL);

    expect(useAthkarStore.getState().settings).toEqual({
      ...before,
      groupOrder: ATHKAR_GROUP_ORDER.EACH_IN_FULL,
    });
    await Promise.resolve();
    const written = JSON.parse(mockSetItem.mock.calls.at(-1)?.[1] ?? "{}");
    expect(written.state.settings.groupOrder).toBe(ATHKAR_GROUP_ORDER.EACH_IN_FULL);
  });
});
