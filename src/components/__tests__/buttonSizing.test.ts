import { buttonLabelFontSize } from "@/components/ui/button/sizing";
import { TEXT_SIZE_MULTIPLIERS } from "@/constants/TextSize";
import { TextSize } from "@/enums/app";

describe("buttonLabelFontSize", () => {
  test("xl at max preset renders 27px", () => {
    expect(buttonLabelFontSize("xl", undefined, TEXT_SIZE_MULTIPLIERS[TextSize.MAX])).toBe(27);
  });

  test("default preset leaves the variant base unchanged", () => {
    expect(buttonLabelFontSize("sm", undefined, 1)).toBe(12);
  });

  test("explicit numeric fontSize wins over the variant and scales", () => {
    expect(buttonLabelFontSize("xl", 20, TEXT_SIZE_MULTIPLIERS[TextSize.LARGE])).toBe(23);
  });

  test("unknown size falls back to md", () => {
    expect(buttonLabelFontSize(undefined, undefined, 1)).toBe(14);
  });
});
