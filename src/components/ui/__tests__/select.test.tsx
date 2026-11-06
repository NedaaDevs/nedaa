import { screen, userEvent } from "@testing-library/react-native";

import { Select } from "@/components/ui/select";
import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import { renderWithTheme } from "@/test-helpers/theme";

jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const LABEL = "Sound";
const PLACEHOLDER = "Choose a sound";
const CHOSEN = { label: "Beep", value: "beep" };
const OTHER = { label: "Athan", value: "athan" };

const t = i18n.t.bind(i18n);

const renderSelect = (selectedValue?: string) =>
  renderWithTheme(
    <Select
      accessibilityLabel={LABEL}
      selectedValue={selectedValue}
      placeholder={PLACEHOLDER}
      items={[CHOSEN, OTHER]}
    />
  );

const open = async () => {
  await userEvent.press(screen.getByRole("combobox"));
};

describe("Select", () => {
  beforeAll(() => i18n.changeLanguage(AppLocale.EN));

  it("names what it sets, then its value", async () => {
    await renderSelect(CHOSEN.value);

    expect(
      screen.getByRole("combobox", {
        name: t("a11y.join", { first: LABEL, second: CHOSEN.label }),
      })
    ).toBeTruthy();
  });

  it("names what it sets while nothing is chosen, and draws the placeholder", async () => {
    await renderSelect();

    expect(screen.getByRole("combobox", { name: LABEL })).toBeTruthy();
    expect(screen.getByText(PLACEHOLDER)).toBeTruthy();
  });

  it("groups its options under the same name", async () => {
    await renderSelect(CHOSEN.value);
    await open();

    expect(screen.getByLabelText(LABEL)).toHaveProp("accessibilityRole", "radiogroup");
    expect(screen.getByRole("radio", { name: CHOSEN.label })).toBeSelected();
    expect(screen.getByRole("radio", { name: OTHER.label })).not.toBeSelected();
  });

  it("offers a named way to close the options", async () => {
    await renderSelect(CHOSEN.value);
    await open();

    await userEvent.press(screen.getByRole("button", { name: t("common.close") }));

    expect(screen.queryByRole("radio")).toBeNull();
  });
});
