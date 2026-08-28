const mockGetCalendars = jest.fn();

jest.mock("expo-localization", () => ({ getCalendars: () => mockGetCalendars() }));

jest.mock("expo-sqlite/kv-store", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

// The seed is read once when the module initialises, so each case needs its own
// module registry to see a different device value.
const loadStore = () => {
  let store: (typeof import("@/stores/preferences"))["usePreferencesStore"] | undefined;
  jest.isolateModules(() => {
    store = require("@/stores/preferences").usePreferencesStore;
  });
  return store!;
};

describe("weekStartsOn", () => {
  beforeEach(() => {
    mockGetCalendars.mockReset();
  });

  it("seeds from the device first weekday, converted to getDay() numbering", () => {
    // Monday: expo reports 2, Date.getDay() calls it 1.
    mockGetCalendars.mockReturnValue([{ firstWeekday: 2, uses24hourClock: false }]);
    expect(loadStore().getState().weekStartsOn).toBe(1);
  });

  it("falls back to Sunday when the device reports nothing", () => {
    mockGetCalendars.mockReturnValue([{}]);
    expect(loadStore().getState().weekStartsOn).toBe(0);
  });

  it("lets the user override the seed", () => {
    mockGetCalendars.mockReturnValue([{ firstWeekday: 1 }]);
    const store = loadStore();
    store.getState().setWeekStartsOn(6);
    expect(store.getState().weekStartsOn).toBe(6);
  });
});
