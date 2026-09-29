import { screen } from "@testing-library/react-native";

import { Text } from "@/components/ui/text";
import { AppDirection, AppLocale } from "@/enums/app";
import { useAppStore } from "@/stores/app";
import { renderWithTheme } from "@/test-helpers/theme";

const WORD = "word";

describe("Text direction", () => {
  // iOS would align by the phone's language; the app's language decides.
  it.each([
    [AppLocale.EN, AppDirection.LTR],
    [AppLocale.MS, AppDirection.LTR],
    [AppLocale.AR, AppDirection.RTL],
    [AppLocale.UR, AppDirection.RTL],
  ] as const)("writes %s text in the %s direction", async (locale, writingDirection) => {
    useAppStore.setState({ locale });
    await renderWithTheme(<Text>{WORD}</Text>);

    expect(screen.getByText(WORD)).toHaveStyle({ writingDirection });
  });
});
