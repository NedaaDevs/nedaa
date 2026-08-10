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
});
