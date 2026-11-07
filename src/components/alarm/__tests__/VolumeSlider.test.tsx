import { screen, userEvent } from "@testing-library/react-native";

import VolumeSlider from "@/components/alarm/VolumeSlider";
import i18n from "@/localization/i18n";
import { renderWithTheme } from "@/test-helpers/theme";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@/hooks/useHaptic", () => ({ useHaptic: () => jest.fn() }));

describe("VolumeSlider", () => {
  it("reads one level as chosen, never every level up to it", async () => {
    await renderWithTheme(<VolumeSlider value={0.75} onChange={jest.fn()} />);

    expect(screen.getByRole("radio", { selected: true })).toBe(
      screen.getByRole("radio", { name: "75%" })
    );
  });

  it("names the group of levels", async () => {
    await renderWithTheme(<VolumeSlider value={1} onChange={jest.fn()} />);

    expect(screen.getByLabelText(i18n.t("alarm.settings.volume"))).toHaveProp(
      "accessibilityRole",
      "radiogroup"
    );
  });

  it("writes the level pressed", async () => {
    const onChange = jest.fn();
    await renderWithTheme(<VolumeSlider value={1} onChange={onChange} />);

    await userEvent.press(screen.getByRole("radio", { name: "50%" }));

    expect(onChange).toHaveBeenCalledWith(0.5);
  });
});
