import i18n from "@/localization/i18n";

const mockState = { useWesternNumerals: false };

jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "ar" }] }));

jest.mock("@/stores/preferences", () => ({
  usePreferencesStore: {
    getState: () => ({ useWesternNumerals: mockState.useWesternNumerals }),
  },
}));

const CLOCK = "settings.preferences.clock.spoken.24h";

beforeEach(() => {
  mockState.useWesternNumerals = false;
});

describe("t() with the numeral post-processor registered", () => {
  it("renders Arabic-Indic digits when the reader keeps Arabic numerals", () => {
    expect(i18n.t(CLOCK)).toBe("نظام ٢٤ ساعة");
  });

  it("renders Western digits when the reader asks for them", () => {
    mockState.useWesternNumerals = true;
    expect(i18n.t(CLOCK)).toBe("نظام 24 ساعة");
  });

  it("applies the preference to interpolated values too", () => {
    expect(i18n.t("settings.hijri.date.adjustments.plusDays", { count: 3 })).toContain("٣");
  });

  it("leaves Quran text in Arabic-Indic whatever the preference", () => {
    mockState.useWesternNumerals = true;
    expect(i18n.t("athkar.items.surahAlIkhlas")).toContain("﴿١﴾");
  });

  it("leaves the Western numeral option in Western digits", () => {
    expect(i18n.t("settings.preferences.numerals.options.western")).toBe("123");
  });

  it("leaves licence identifiers alone", () => {
    expect(i18n.t("settings.acknowledgements.cities.body")).toContain("CC BY 4.0");
  });

  it("leaves other locales untouched", async () => {
    await i18n.changeLanguage("en");
    expect(i18n.t(CLOCK)).toBe("24-hour time");
    await i18n.changeLanguage("ar");
  });
});
