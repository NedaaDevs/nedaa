import { View } from "react-native";
import { screen, userEvent } from "@testing-library/react-native";

import ReaderBarButton from "@/components/quran/ReaderBarButton";
import i18n from "@/localization/i18n";
import { controlProblems, drawnWidthOf, MIN_TARGET } from "@/test-helpers/controls";
import { renderWithTheme } from "@/test-helpers/theme";

const label = i18n.t("quran.search.placeholder");

/** The button around a stand-in icon. */
const renderButton = (onPress = jest.fn()) =>
  renderWithTheme(
    <ReaderBarButton onPress={onPress} label={label}>
      <View />
    </ReaderBarButton>
  );

it("is a named button with a 44 pt target both ways", async () => {
  await renderButton();

  expect(controlProblems()).toEqual([]);
  expect(drawnWidthOf(screen.getByRole("button").props.style)).toBeGreaterThanOrEqual(MIN_TARGET);
});

it("runs its action on a press", async () => {
  const onPress = jest.fn();
  await renderButton(onPress);

  await userEvent.press(screen.getByRole("button", { name: label }));

  expect(onPress).toHaveBeenCalledTimes(1);
});
