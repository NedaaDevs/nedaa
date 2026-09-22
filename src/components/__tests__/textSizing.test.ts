import { resolveTextSizing } from "@/components/ui/text/sizing";
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
