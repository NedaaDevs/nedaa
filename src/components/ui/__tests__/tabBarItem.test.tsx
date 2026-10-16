import { House } from "lucide-react-native";
import { screen, userEvent } from "@testing-library/react-native";

import config from "../../../../tamagui.config";
import { TabBarItem } from "@/components/ui/tab-bar-item";
import { renderWithTheme } from "@/test-helpers/theme";

const LIGHT = config.themes.light;
const LABEL = "Today";

const renderItem = (selected: boolean, onPress = jest.fn()) =>
  renderWithTheme(<TabBarItem label={LABEL} icon={House} selected={selected} onPress={onPress} />);

const tab = () => screen.getByRole("tab", { name: LABEL });

describe("TabBarItem", () => {
  it.each([true, false])("is a tab that reports selected: %s", async (selected) => {
    await renderItem(selected);

    expect(screen.getByRole("tab", { name: LABEL, selected })).toBeOnTheScreen();
  });

  it("fires on press", async () => {
    const onPress = jest.fn();
    await renderItem(false, onPress);

    await userEvent.setup().press(tab());

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  // The tab bar sits above the 44pt floor every other control holds.
  it("holds the tab touch floor", async () => {
    await renderItem(false);

    expect(tab()).toHaveStyle({ minHeight: config.tokens.size.targetTab.val });
  });

  it.each([
    ["selected", true, LIGHT.accent.val],
    ["idle", false, LIGHT.muted.val],
  ])("draws a %s label in its colour", async (_state, selected, colour) => {
    await renderItem(selected);

    expect(screen.getByText(LABEL)).toHaveStyle({ color: colour });
  });
});
