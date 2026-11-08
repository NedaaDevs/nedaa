import { BackHandler } from "react-native";
import { screen, within } from "@testing-library/react-native";

import { TimePickerBody, type TimePickerBodyProps } from "@/components/TimePickerBody";
import i18n from "@/localization/i18n";
import { androidBack } from "@/test-helpers/backHandler";
import { renderWithTheme } from "@/test-helpers/theme";

const t = i18n.t.bind(i18n);
const TITLE = t("settings.athkar.notifications.morning.title");

const picker = ({
  onTimeChange = jest.fn(),
  onClose = jest.fn(),
}: Partial<TimePickerBodyProps> = {}) => (
  <TimePickerBody
    title={TITLE}
    currentHour={17}
    currentMinute={30}
    use12HourFormat
    isPM
    onTimeChange={onTimeChange}
    onClose={onClose}
  />
);

describe("TimePickerBody", () => {
  // Each radio says only its number, so its group names the column.
  it("groups the hours and the minutes under their column names", async () => {
    await renderWithTheme(picker());

    const hours = screen.getByLabelText(t("common.hourLabel"));
    const minutes = screen.getByLabelText(t("common.minute"));
    expect(hours).toHaveProp("accessibilityRole", "radiogroup");
    expect(minutes).toHaveProp("accessibilityRole", "radiogroup");
    expect(within(hours).getByRole("radio", { name: "5", selected: true })).toBeTruthy();
    expect(within(minutes).getByRole("radio", { name: "30", selected: true })).toBeTruthy();
  });

  // The time alone does not say which reminder it sets.
  it("names the picker with its title", async () => {
    await renderWithTheme(picker());

    expect(screen.getByRole("header", { name: TITLE })).toBeTruthy();
  });

  it("cancels on Android's back", async () => {
    const pressBack = androidBack();
    const onTimeChange = jest.fn();
    const onClose = jest.fn();
    await renderWithTheme(picker({ onTimeChange, onClose }));

    expect(await pressBack()).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onTimeChange).not.toHaveBeenCalled();
  });

  // A caller's inline onClose is a new function on every render.
  it("leaves back to a dialog above it when its parent re-renders", async () => {
    const pressBack = androidBack();
    const onClose = jest.fn();
    await renderWithTheme(picker());
    const above = jest.fn(() => true);
    BackHandler.addEventListener("hardwareBackPress", above);
    await screen.rerender(picker({ onClose }));

    expect(await pressBack()).toBe(true);
    expect(above).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("cancels through the onClose of its latest render", async () => {
    const pressBack = androidBack();
    const onClose = jest.fn();
    await renderWithTheme(picker());
    await screen.rerender(picker({ onClose }));

    await pressBack();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
