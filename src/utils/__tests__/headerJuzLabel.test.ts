import i18n from "@/localization/i18n";
import { headerJuzLabel } from "@/utils/juz";
import { headerSurahLabel } from "@/utils/surahName";

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
  it("uses the vocalized print form", () => {
    expect(headerJuzLabel(1)).toBe("الجُزْءُ الأَوَّلُ");
    expect(headerJuzLabel(15)).toBe("الجُزْءُ الخَامِسَ عَشَرَ");
    expect(headerJuzLabel(30)).toBe("الجُزْءُ الثَّلَاثُونَ");
  });
});

describe("headerSurahLabel", () => {
  it("uses the vocalized genitive print form in Arabic", async () => {
    await i18n.changeLanguage("ar");
    expect(headerSurahLabel(1)).toBe("سُورَةُ الفَاتِحَةِ");
    expect(headerSurahLabel(3)).toBe("سُورَةُ آلِ عِمْرَانَ");
  });
  it("keeps the localized form in English", async () => {
    await i18n.changeLanguage("en");
    expect(headerSurahLabel(2)).toBe("Surah Al-Baqarah");
  });
});
