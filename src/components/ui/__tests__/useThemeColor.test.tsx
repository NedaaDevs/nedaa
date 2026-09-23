import { memo } from "react";
import { Text } from "react-native";
import { act, render, screen } from "@testing-library/react-native";
import { TamaguiProvider } from "tamagui";

import config from "../../../../tamagui.config";
import { useThemeColor } from "@/components/ui/theme-color";
import { AppMode } from "@/enums/app";
import { useAppStore } from "@/stores/app";

const TOKEN = "$backgroundSecondary";

// Memoised, as the React Compiler leaves most components: no parent re-render rescues it.
const Reader = memo(function Reader() {
  return <Text testID="colour">{useThemeColor(TOKEN)}</Text>;
});

/** Picks the root theme from the stored mode, as the app layout does. */
const Root = () => {
  const mode = useAppStore((state) => state.mode);
  return (
    <TamaguiProvider
      config={config}
      defaultTheme={mode === AppMode.DARK ? AppMode.DARK : AppMode.LIGHT}>
      <Reader />
    </TamaguiProvider>
  );
};

describe("useThemeColor", () => {
  it("follows a change of the app's theme", async () => {
    useAppStore.setState({ mode: AppMode.LIGHT });
    await render(<Root />);
    expect(screen.getByTestId("colour")).toHaveTextContent(
      config.themes.light.backgroundSecondary.val
    );

    await act(() => useAppStore.setState({ mode: AppMode.DARK }));

    expect(screen.getByTestId("colour")).toHaveTextContent(
      config.themes.dark.backgroundSecondary.val
    );
  });
});
