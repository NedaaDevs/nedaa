let mockSaved: string | null = null;

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
    setItem: jest.fn(async () => {}),
    removeItem: jest.fn(async () => {}),
  },
}));
jest.mock("@/utils/appLogger", () => ({
  AppLogger: { create: () => ({ i: jest.fn(), w: jest.fn(), e: jest.fn() }) },
}));

/* eslint-disable import/first -- imports must follow jest.mock hoisting */
import { ATHKAR_LOOK } from "@/constants/AthkarLook";
import { useAthkarStore } from "@/stores/athkar";
/* eslint-enable import/first */

const DEFAULTS = useAthkarStore.getState().settings;

const settings = () => useAthkarStore.getState().settings;

/** Loads the store, holding `held`, from a saved record with these settings and other fields. */
const rehydrate = async (saved: object | undefined, rest: object = {}, held = DEFAULTS) => {
  const state = saved === undefined ? rest : { ...rest, settings: saved };
  mockSaved = JSON.stringify({ state, version: 0 });
  useAthkarStore.setState({ settings: held });
  await useAthkarStore.persist.rehydrate();
};

describe("the stored Athkar look", () => {
  it("is not chosen before a person chooses", () => expect(DEFAULTS.look).toBeNull());

  it("stays unchosen for a record saved before looks, which keeps its own settings", async () => {
    await rehydrate({ autoMoveToNext: false, showStreak: true, showTranslation: false });

    expect(settings()).toEqual({
      autoMoveToNext: false,
      showStreak: true,
      showTranslation: false,
      look: null,
    });
  });

  it("keeps every default for a record with no settings", async () => {
    await rehydrate(undefined);

    expect(settings()).toEqual(DEFAULTS);
  });

  it("keeps what the record holds beside its settings", async () => {
    useAthkarStore.setState({ focusHintSeen: false, shortVersion: false });
    await rehydrate({ showStreak: true }, { focusHintSeen: true, shortVersion: true });

    expect(useAthkarStore.getState()).toMatchObject({ focusHintSeen: true, shortVersion: true });
  });

  it("takes the look from the record alone, whatever look the store holds", async () => {
    const held = { ...DEFAULTS, look: ATHKAR_LOOK.CLASSIC };
    await rehydrate({ showStreak: true }, {}, held);

    expect(settings().look).toBeNull();
  });

  it("keeps a saved look", async () => {
    await rehydrate({ ...DEFAULTS, look: ATHKAR_LOOK.CLASSIC });

    expect(settings().look).toBe(ATHKAR_LOOK.CLASSIC);
  });

  it.each(["a-look-this-build-lacks", 3, {}])("drops the unknown look %p", async (look) => {
    await rehydrate({ ...DEFAULTS, look });

    expect(settings().look).toBeNull();
  });

  it("stores a chosen look", () => {
    const before = { ...DEFAULTS, showTranslation: !DEFAULTS.showTranslation };
    useAthkarStore.setState({ settings: before });

    useAthkarStore.getState().setLook(ATHKAR_LOOK.CLASSIC);

    expect(settings()).toEqual({ ...before, look: ATHKAR_LOOK.CLASSIC });
  });
});
