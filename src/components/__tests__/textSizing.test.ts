import {
  FONT_SIZES,
  ROLE_RATIO,
  SIZE_MAP,
  resolveTextSizing,
  roleLineHeight,
} from "@/components/ui/text/sizing";
import { readFileSync } from "fs";
import { join } from "path";

import { TEXT_SIZE_MULTIPLIERS } from "@/constants/TextSize";
import { TextSize } from "@/enums/app";

const MD = { fontSize: 14, lineHeight: 20 }; // the size="md" table entry

describe("resolveTextSizing", () => {
  test("token size at the default preset is unchanged", () => {
    expect(resolveTextSizing(1, undefined, MD)).toEqual({ fontSize: 14, lineHeight: 20 });
  });

  test("token size at max renders 21px on a 30px line", () => {
    const m = TEXT_SIZE_MULTIPLIERS[TextSize.MAX];
    expect(resolveTextSizing(m, undefined, MD)).toEqual({ fontSize: 21, lineHeight: 30 });
  });

  test("explicit numeric fontSize scales; line box follows the font", () => {
    const m = TEXT_SIZE_MULTIPLIERS[TextSize.LARGE];
    expect(resolveTextSizing(m, 20, MD)).toEqual({ fontSize: 23, lineHeight: undefined });
  });

  test("explicit token fontSize resolves through the table, then scales", () => {
    const m = TEXT_SIZE_MULTIPLIERS[TextSize.XLARGE];
    // $5 = 18px in the font table
    expect(resolveTextSizing(m, "$5", MD).fontSize).toBeCloseTo(23.4);
  });

  test("unresolvable fontSize yields undefined, not NaN", () => {
    expect(resolveTextSizing(1.5, "$99", MD)).toEqual({
      fontSize: undefined,
      lineHeight: undefined,
    });
  });

  test("preserves the Arabic dua line height at every text-size preset", () => {
    const dua = { fontSize: 20, lineHeight: 28 };
    for (const m of Object.values(TEXT_SIZE_MULTIPLIERS)) {
      expect(resolveTextSizing(m, undefined, dua, 42)).toEqual({
        fontSize: 20 * m,
        lineHeight: 42 * m,
      });
    }
  });

  test("scales explicit lineHeight alongside explicit fontSize", () => {
    expect(resolveTextSizing(1.5, 20, MD, 36)).toEqual({ fontSize: 30, lineHeight: 54 });
  });

  test("resolves line-height tokens from the line-height table", () => {
    expect(resolveTextSizing(1.5, undefined, MD, "$5").lineHeight).toBe(42);
  });
});

describe("explicit lineHeight", () => {
  test("an explicit line box wins over the size table, and scales", () => {
    const m = TEXT_SIZE_MULTIPLIERS[TextSize.LARGE];

    expect(resolveTextSizing(m, undefined, MD, 30)).toEqual({
      fontSize: 14 * m,
      lineHeight: 30 * m,
    });
  });

  test("an explicit line box survives an explicit fontSize", () => {
    expect(resolveTextSizing(1, 20, MD, 28)).toEqual({ fontSize: 20, lineHeight: 28 });
  });

  test("an unresolvable line box falls back to the size table", () => {
    expect(resolveTextSizing(1, undefined, MD, "$99")).toEqual({ fontSize: 14, lineHeight: 20 });
  });
});

describe("typographic roles", () => {
  test("each role states a ratio that clears the Arabic floor", () => {
    for (const ratio of Object.values(ROLE_RATIO)) {
      expect(ratio).toBeGreaterThanOrEqual(1.3);
    }
  });

  test("a role derives the line box from the font size", () => {
    expect(roleLineHeight("display", 48)).toBe(62);
    expect(roleLineHeight("body", 16)).toBe(26);
  });

  // The display sizes run as tight as 1.0, which clips Arabic diacritics.
  test("display opens up the line box the size table leaves flat", () => {
    expect(roleLineHeight("display", 48)).toBeGreaterThan(FONT_SIZES.$10.lineHeight);
  });

  test("no role leaves the size table alone", () => {
    expect(roleLineHeight(undefined, 48)).toBeUndefined();
  });
});

describe("token line heights", () => {
  // A token must read the line-height column, not the font-size one.
  test("a line-height token resolves to the box the table declares", () => {
    expect(resolveTextSizing(1, undefined, MD, "$4")).toEqual({
      fontSize: 14,
      lineHeight: FONT_SIZES.$4.lineHeight,
    });
  });

  test("an unknown line-height token falls back to the size table", () => {
    expect(resolveTextSizing(1, undefined, MD, "$99")).toEqual({ fontSize: 14, lineHeight: 20 });
  });
});

describe("premium type steps", () => {
  const STEPS = {
    "$10.5": { fontSize: 40, lineHeight: 52 },
    "$7.5": { fontSize: 26, lineHeight: 34 },
    "$3.75": { fontSize: 15, lineHeight: 21 },
    "$2.75": { fontSize: 13, lineHeight: 20 },
  } as const;

  it.each(Object.entries(STEPS))("%s is %j", (step, values) => {
    expect(FONT_SIZES[step]).toEqual(values);
  });

  it.each([
    ["display", "$10.5"],
    ["heading", "$7.5"],
    ["label", "$3.75"],
    ["helper", "$2.75"],
  ] as const)("size %s maps to %s", (name, step) => {
    expect(SIZE_MAP[name]).toBe(step);
  });

  // The config and FONT_SIZES are two copies of one table; compare both over every step.
  describe.each(["latinFont", "arabicFont"])("%s", (font) => {
    const block = (key: "size" | "lineHeight") => {
      const source = readFileSync(join(__dirname, "../../../tamagui.config.ts"), "utf8");
      const font$ = source.match(
        new RegExp(`const ${font} = createFont\\(\\{([\\s\\S]*?)\\n\\}\\);`)
      );
      const table = font$?.[1].match(new RegExp(`\\n  ${key}: \\{([\\s\\S]*?)\\n  \\},`));
      if (!table) throw new Error(`${font} ${key} not found`);
      return Object.fromEntries(
        [...table[1].matchAll(/^\s*"?([\d.]+)"?:\s*(\d+),/gm)].map((m) => [
          `$${m[1]}`,
          Number(m[2]),
        ])
      );
    };

    it("matches FONT_SIZES at every step", () => {
      const size = block("size");
      const lineHeight = block("lineHeight");

      expect(Object.keys(size).sort()).toEqual(Object.keys(FONT_SIZES).sort());
      for (const [step, values] of Object.entries(FONT_SIZES)) {
        expect([step, size[step], lineHeight[step]]).toEqual([
          step,
          values.fontSize,
          values.lineHeight,
        ]);
      }
    });
  });
});

describe("title role", () => {
  test("opens to 1.3 above 24pt", () => {
    expect(roleLineHeight("title", 30)).toBe(39);
  });

  test("stays at 1.4 at 24pt and below", () => {
    expect(roleLineHeight("title", 24)).toBe(34);
    expect(roleLineHeight("title", 16)).toBe(22);
  });

  test("titleLoose keeps 1.4 at every size", () => {
    expect(roleLineHeight("titleLoose", 30)).toBe(42);
    expect(roleLineHeight("titleLoose", 36)).toBe(50);
  });

  test("display holds 1.3 at the 40pt step", () => {
    expect(roleLineHeight("display", 40)).toBe(52);
  });
});
