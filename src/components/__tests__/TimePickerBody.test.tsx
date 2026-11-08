import { screen, within } from "@testing-library/react-native";

import { TimePickerBody } from "@/components/TimePickerBody";
import i18n from "@/localization/i18n";
import { renderWithTheme } from "@/test-helpers/theme";

const t = i18n.t.bind(i18n);

const renderPicker = () =>
  renderWithTheme(
    <TimePickerBody
      currentHour={17}
      currentMinute={30}
      use12HourFormat
      isPM
      onTimeChange={jest.fn()}
      onClose={jest.fn()}
    />
  );

describe("TimePickerBody", () => {
  // Each radio says only its number, so its group names the column.
  it("groups the hours and the minutes under their column names", async () => {
    await renderPicker();

    const hours = screen.getByLabelText(t("common.hourLabel"));
    const minutes = screen.getByLabelText(t("common.minute"));
    expect(hours).toHaveProp("accessibilityRole", "radiogroup");
    expect(minutes).toHaveProp("accessibilityRole", "radiogroup");
    expect(within(hours).getByRole("radio", { name: "5", selected: true })).toBeTruthy();
    expect(within(minutes).getByRole("radio", { name: "30", selected: true })).toBeTruthy();
  });
});
