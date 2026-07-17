import i18n from "@/localization/i18n";
import { rubForHizbQuarter, rubLabel } from "@/utils/juz";

jest.mock("expo-sqlite/kv-store", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  getItemSync: jest.fn(),
  setItemSync: jest.fn(),
}));

describe("rubForHizbQuarter", () => {
  it("maps rub number to hizb + quarter index", () => {
    expect(rubForHizbQuarter(1)).toEqual({ hizb: 1, quarter: 0 }); // hizb 1 start
    expect(rubForHizbQuarter(2)).toEqual({ hizb: 1, quarter: 1 }); // 1/4
    expect(rubForHizbQuarter(3)).toEqual({ hizb: 1, quarter: 2 }); // 1/2
    expect(rubForHizbQuarter(4)).toEqual({ hizb: 1, quarter: 3 }); // 3/4
    expect(rubForHizbQuarter(5)).toEqual({ hizb: 2, quarter: 0 }); // hizb 2 start
    expect(rubForHizbQuarter(240)).toEqual({ hizb: 60, quarter: 3 });
  });
});

describe("rubLabel (Arabic)", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("ar");
  });
  it("labels a hizb start with just the hizb", () => {
    expect(rubLabel(1)).toBe("الحزب ١");
  });
  it("labels three-quarters as ٣/٤ of the hizb", () => {
    expect(rubLabel(4)).toBe("٣/٤ الحزب ١");
  });
});

describe("rubLabel (English)", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });
  it("labels quarters with Latin fractions", () => {
    expect(rubLabel(1)).toBe("Hizb 1");
    expect(rubLabel(4)).toBe("3/4 Hizb 1");
  });
});
