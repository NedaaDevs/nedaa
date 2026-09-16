import i18n from "@/localization/i18n";

const mockState = { useWesternNumerals: false };

jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "ar" }] }));

jest.mock("@/stores/preferences", () => ({
  usePreferencesStore: {
    getState: () => ({ useWesternNumerals: mockState.useWesternNumerals }),
  },
}));

const DESCRIPTION = "settings.preferences.use24HourTime.description";

beforeEach(() => {
  mockState.useWesternNumerals = false;
});

describe("t() with the numeral post-processor registered", () => {
  it("renders Arabic-Indic digits when the reader keeps Arabic numerals", () => {
    expect(i18n.t(DESCRIPTION)).toBe("عرض المواقيت بصيغة ١٧:٣٠ بدلًا من ٥:٣٠ م");
  });

  it("renders Western digits when the reader asks for them", () => {
    mockState.useWesternNumerals = true;
    expect(i18n.t(DESCRIPTION)).toBe("عرض المواقيت بصيغة 17:30 بدلًا من 5:30 م");
  });

  it("applies the preference to interpolated values too", () => {
    expect(i18n.t("settings.hijri.date.adjustments.days", { count: 3 })).toContain("٣");
  });

  it("leaves Quran text in Arabic-Indic whatever the preference", () => {
    mockState.useWesternNumerals = true;
    expect(i18n.t("athkar.items.surahAlIkhlas")).toContain("﴿١﴾");
  });

  it("leaves the numeral preference's own label showing both digit sets", () => {
    expect(i18n.t("settings.preferences.westernNumerals.description")).toContain("(1، 2، 3)");
  });

  it("leaves licence identifiers alone", () => {
    expect(i18n.t("settings.acknowledgements.cities.body")).toContain("CC BY 4.0");
  });

  it("leaves other locales untouched", async () => {
    await i18n.changeLanguage("en");
    expect(i18n.t(DESCRIPTION)).toBe("Show prayer times as 17:30 instead of 5:30 PM");
    await i18n.changeLanguage("ar");
  });
});
