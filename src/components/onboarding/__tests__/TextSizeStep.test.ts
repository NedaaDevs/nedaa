import { PixelRatio } from "react-native";

import { isLargeOsTextActive } from "@/utils/textSizeOffer";

test.each([
  [1.0, false],
  [1.14, false],
  [1.15, true],
  [2.0, true],
])("fontScale %f → shows the text-size offer: %s", (scale, expected) => {
  jest.spyOn(PixelRatio, "getFontScale").mockReturnValue(scale);
  expect(isLargeOsTextActive()).toBe(expected);
});
