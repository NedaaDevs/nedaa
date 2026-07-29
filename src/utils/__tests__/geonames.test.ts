import {
  parseCityLine,
  parseAlternateNameLine,
  pickPreferredName,
  sanitizeName,
} from "@/utils/geonames";

const cityLine = (fields: Partial<Record<number, string>>) => {
  const f = Array<string>(19).fill("");
  f[0] = "108410";
  f[1] = "Riyadh";
  f[2] = "Riyadh";
  f[4] = "24.68773";
  f[5] = "46.72185";
  f[8] = "SA";
  f[10] = "10";
  f[14] = "4205961";
  f[17] = "Asia/Riyadh";
  f[18] = "2026-04-13";
  for (const [index, value] of Object.entries(fields)) f[Number(index)] = value as string;
  return f.join("\t");
};

describe("parseCityLine", () => {
  test("extracts coordinates, population and IANA timezone", () => {
    expect(parseCityLine(cityLine({}))).toEqual({
      gid: 108410,
      name: "Riyadh",
      ascii: null,
      latitude: 24.68773,
      longitude: 46.72185,
      countryCode: "SA",
      admin1Code: "10",
      population: 4205961,
      timezone: "Asia/Riyadh",
    });
  });

  test("keeps ascii only when it differs from the name", () => {
    expect(parseCityLine(cityLine({ 1: "Ar Riyāḑ", 2: "Ar Riyad" }))?.ascii).toBe("Ar Riyad");
  });

  test("treats a missing admin1 code as no region", () => {
    expect(parseCityLine(cityLine({ 10: "" }))?.admin1Code).toBeNull();
  });

  test("defaults an unknown population to zero so ordering stays numeric", () => {
    expect(parseCityLine(cityLine({ 14: "" }))?.population).toBe(0);
  });

  test("rejects a row with no timezone, which would break prayer times silently", () => {
    expect(parseCityLine(cityLine({ 17: "" }))).toBeNull();
  });

  test("rejects a row with unparseable coordinates", () => {
    expect(parseCityLine(cityLine({ 4: "north" }))).toBeNull();
  });

  test("rejects a truncated row", () => {
    expect(parseCityLine("108410\tRiyadh")).toBeNull();
  });
});

describe("parseAlternateNameLine", () => {
  test("keeps a wanted language and reports the preferred flag", () => {
    expect(parseAlternateNameLine("1\t108410\tar\tالرياض\t1\t0\t0\t0")).toEqual({
      gid: 108410,
      lang: "ar",
      name: "الرياض",
      isPreferred: true,
    });
  });

  test("drops historic names", () => {
    expect(parseAlternateNameLine("2\t108410\tar\tقديم\t0\t0\t0\t1")).toBeNull();
  });

  test("drops colloquial names", () => {
    expect(parseAlternateNameLine("3\t108410\tur\tبول چال\t0\t0\t1\t0")).toBeNull();
  });

  test("drops languages the app does not ship", () => {
    expect(parseAlternateNameLine("4\t108410\tfr\tRiyad\t0\t0\t0\t0")).toBeNull();
  });

  test("drops a blank name", () => {
    expect(parseAlternateNameLine("5\t108410\tar\t   \t0\t0\t0\t0")).toBeNull();
  });

  test("accepts Malay", () => {
    expect(parseAlternateNameLine("6\t1735161\tms\tKuala Lumpur\t0\t0\t0\t0")?.lang).toBe("ms");
  });
});

describe("pickPreferredName", () => {
  test("prefers the flagged-preferred name over an earlier one", () => {
    expect(
      pickPreferredName(
        { name: "First", isPreferred: false },
        { name: "Official", isPreferred: true }
      )
    ).toBe("Official");
  });

  test("keeps the incumbent when neither is flagged", () => {
    expect(
      pickPreferredName(
        { name: "First", isPreferred: false },
        { name: "Second", isPreferred: false }
      )
    ).toBe("First");
  });

  test("keeps an already-preferred incumbent against a later preferred name", () => {
    expect(
      pickPreferredName(
        { name: "Official", isPreferred: true },
        { name: "Other", isPreferred: true }
      )
    ).toBe("Official");
  });
});

describe("sanitizeName", () => {
  test("strips a trailing left-to-right mark, which GeoNames scatters through Arabic names", () => {
    expect(
      sanitizeName("\u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0631\u064A\u0627\u0636\u200E")
    ).toBe("\u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0631\u064A\u0627\u0636");
  });

  test("strips zero-width spaces and joiners", () => {
    expect(sanitizeName("Ka\u200Bbul\u200D")).toBe("Kabul");
  });

  test("strips a byte order mark", () => {
    expect(sanitizeName("\uFEFFLahore")).toBe("Lahore");
  });

  test("strips bidi isolate controls", () => {
    expect(sanitizeName("\u2066Riyadh\u2069")).toBe("Riyadh");
  });

  test("trims surrounding whitespace", () => {
    expect(sanitizeName("  Bradford  ")).toBe("Bradford");
  });

  test("leaves an ordinary name untouched", () => {
    expect(sanitizeName("Kuala Lumpur")).toBe("Kuala Lumpur");
  });
});
