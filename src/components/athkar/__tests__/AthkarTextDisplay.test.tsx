import { StyleSheet } from "react-native";
import { screen } from "@testing-library/react-native";

import AthkarTextDisplay from "@/components/athkar/AthkarTextDisplay";
import { TEXT_SIZE_MULTIPLIERS } from "@/constants/TextSize";
import { TextSize } from "@/enums/app";
import { TextScaleContext } from "@/hooks/useTextScale";
import "@/localization/i18n";
import { renderWithTheme } from "@/test-helpers/theme";

jest.mock("@/utils/appLogger", () => ({
  AppLogger: { create: () => ({ i: jest.fn(), w: jest.fn(), e: jest.fn() }) },
}));

/** A text key no locale holds, so it draws as written. */
const TEXT = "dhikr text";

const lineBoxAt = async (size: (typeof TextSize)[keyof typeof TextSize]) => {
  const view = await renderWithTheme(
    <TextScaleContext value={TEXT_SIZE_MULTIPLIERS[size]}>
      <AthkarTextDisplay textKey={TEXT} size="heading" />
    </TextScaleContext>
  );
  const { fontSize, lineHeight } = StyleSheet.flatten(screen.getByText(TEXT).props.style);
  await view.unmount();
  return lineHeight / fontSize;
};

describe("AthkarTextDisplay", () => {
  it("keeps the line box in step with the letters at every text size", async () => {
    const atDefault = await lineBoxAt(TextSize.DEFAULT);
    for (const size of Object.values(TextSize)) {
      expect(await lineBoxAt(size)).toBeCloseTo(atDefault);
    }
  });
});
