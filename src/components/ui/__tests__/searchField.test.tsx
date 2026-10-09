import { useState } from "react";
import { screen, userEvent } from "@testing-library/react-native";

import { SearchField } from "@/components/ui/search-field";
import i18n from "@/localization/i18n";
import { renderWithTheme } from "@/test-helpers/theme";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@gorhom/bottom-sheet", () => jest.requireActual("@/test-helpers/bottomSheetMock"));

const PLACEHOLDER = "Search methods";

const Harness = ({ initial = "" }: { initial?: string }) => {
  const [value, setValue] = useState(initial);
  return <SearchField value={value} onChangeText={setValue} placeholder={PLACEHOLDER} />;
};

describe("SearchField", () => {
  it("offers no clear button while the field is empty", async () => {
    await renderWithTheme(<Harness />);

    expect(screen.queryByRole("button", { name: i18n.t("a11y.common.clearSearch") })).toBeNull();
  });

  it("clears the text from its clear button", async () => {
    await renderWithTheme(<Harness initial="Umm" />);

    await userEvent.press(screen.getByRole("button", { name: i18n.t("a11y.common.clearSearch") }));

    expect(screen.getByPlaceholderText(PLACEHOLDER).props.value).toBe("");
    expect(screen.queryByRole("button", { name: i18n.t("a11y.common.clearSearch") })).toBeNull();
  });

  // The placeholder hides once there is text; the field keeps its name.
  it("keeps its name once text hides the placeholder", async () => {
    await renderWithTheme(<Harness initial="Umm" />);

    expect(screen.getByLabelText(PLACEHOLDER).props.value).toBe("Umm");
  });
});
