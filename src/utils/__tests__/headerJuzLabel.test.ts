import i18n from "@/localization/i18n";
import { headerJuzLabel } from "@/utils/juz";

jest.mock("expo-sqlite/kv-store", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  getItemSync: jest.fn(),
  setItemSync: jest.fn(),
}));

describe("headerJuzLabel (en)", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });
  it("says Part N, not Juz N", () => {
    expect(headerJuzLabel(5)).toBe("Part 5");
  });
  it("returns empty outside 1..30", () => {
    expect(headerJuzLabel(0)).toBe("");
    expect(headerJuzLabel(31)).toBe("");
  });
});

describe("headerJuzLabel (ar)", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("ar");
  });
  it("keeps the Arabic ordinal form", () => {
    expect(headerJuzLabel(1)).toBe("الجزء الأول");
  });
});
