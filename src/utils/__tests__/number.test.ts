import { formatNumberToLocale } from "@/utils/number";

const mockState = { locale: "ar", useWesternNumerals: false };

jest.mock("@/stores/app", () => ({
  __esModule: true,
  default: { getState: () => ({ locale: mockState.locale }) },
}));

jest.mock("@/stores/preferences", () => ({
  usePreferencesStore: {
    getState: () => ({ useWesternNumerals: mockState.useWesternNumerals }),
  },
}));

beforeEach(() => {
  mockState.locale = "ar";
  mockState.useWesternNumerals = false;
});

describe("formatNumberToLocale", () => {
  it("renders Western digits as Arabic-Indic when Arabic numerals are kept", () => {
    expect(formatNumberToLocale("17:30")).toBe("١٧:٣٠");
  });

  it("passes the text through when Western numerals are chosen", () => {
    mockState.useWesternNumerals = true;
    expect(formatNumberToLocale("17:30")).toBe("17:30");
  });

  // Western digits are the canonical stored form, so nothing converts back. Text that
  // reaches here already in Arabic-Indic is deliberate and stays that way.
  it("leaves Arabic-Indic digits alone in either direction", () => {
    expect(formatNumberToLocale("﴿١﴾")).toBe("﴿١﴾");
    mockState.useWesternNumerals = true;
    expect(formatNumberToLocale("﴿١﴾")).toBe("﴿١﴾");
  });

  it("converts every digit in a mixed string", () => {
    expect(formatNumberToLocale("عرض المواقيت بصيغة 17:30 بدلًا من 5:30 م")).toBe(
      "عرض المواقيت بصيغة ١٧:٣٠ بدلًا من ٥:٣٠ م"
    );
  });

  it("leaves other locales untouched", () => {
    mockState.locale = "en";
    expect(formatNumberToLocale("17:30")).toBe("17:30");
  });
});
