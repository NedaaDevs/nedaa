import { StyleSheet } from "react-native";
import { screen } from "@testing-library/react-native";

import { AthkarFocusCompletion } from "@/components/athkar/AthkarFocusCompletion";
import { ATHKAR_TYPE } from "@/constants/Athkar";
import i18n from "@/localization/i18n";
import { renderWithTheme } from "@/test-helpers/theme";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("expo-router", () => ({ useRouter: () => ({ back: jest.fn() }) }));
jest.mock("@/utils/reviewPrompt", () => ({ promptReviewIfEligible: jest.fn() }));

describe("AthkarFocusCompletion", () => {
  // A button size taller than the disc would stretch it into an oval.
  it("draws the close button as a round disc", async () => {
    await renderWithTheme(
      <AthkarFocusCompletion
        currentType={ATHKAR_TYPE.MORNING}
        athkarCount={3}
        completionStyle={{}}
      />
    );
    const style = StyleSheet.flatten(
      screen.getByRole("button", { name: i18n.t("common.close") }).props.style
    );

    expect(Math.max(style.height, style.minHeight ?? 0)).toBe(style.width);
  });
});
