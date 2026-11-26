import { View } from "react-native";

import { SHEET_CHROME_PART } from "@/constants/SheetChrome";
import { gorhomStops } from "@/test-helpers/bottomSheetMock";
import { renderWithTheme } from "@/test-helpers/theme";

describe("gorhomStops", () => {
  it("reports the app's sheet background when a reader lands on it", async () => {
    await renderWithTheme(<View testID={SHEET_CHROME_PART.BACKGROUND} accessible />);

    expect(gorhomStops()).toEqual([
      { testID: SHEET_CHROME_PART.BACKGROUND, label: undefined, hint: undefined, role: undefined },
    ]);
  });

  it("passes over the app's sheet background while it is silent", async () => {
    await renderWithTheme(<View testID={SHEET_CHROME_PART.BACKGROUND} />);

    expect(gorhomStops()).toEqual([]);
  });
});
