import { getUnseenEntries, WhatsNewId, WHATS_NEW_ENTRIES } from "@/constants/WhatsNew";

jest.mock("expo-sqlite/kv-store", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

const baseCtx = {
  umrahInProgress: false,
  fontScale: 1.0,
  textSizeOfferHandled: false,
};

const textSizeVisible = (ctx: typeof baseCtx) =>
  getUnseenEntries([], ctx, WHATS_NEW_ENTRIES).some((e) => e.id === WhatsNewId.TEXT_SIZE);

describe("text-size What's New gate", () => {
  test("hidden at normal OS scale", () => {
    expect(textSizeVisible({ ...baseCtx, fontScale: 1.0 })).toBe(false);
  });

  test("visible at large OS scale when unhandled", () => {
    expect(textSizeVisible({ ...baseCtx, fontScale: 1.3 })).toBe(true);
  });

  test("hidden once handled", () => {
    expect(textSizeVisible({ ...baseCtx, fontScale: 1.3, textSizeOfferHandled: true })).toBe(false);
  });
});
