import { readFileSync } from "fs";
import { memo } from "react";
import { Text } from "react-native";
import { act, render, screen } from "@testing-library/react-native";
import { TamaguiProvider } from "tamagui";

import config from "../../../../tamagui.config";
import { useTheme, useThemeColor } from "@/components/ui/theme-color";
import { AppMode } from "@/enums/app";
import { useAppStore } from "@/stores/app";
import { REPO_ROOT, walkFiles } from "@/test-helpers/routeTree";

const TOKEN = "$backgroundSecondary";

// Memoised, as the React Compiler leaves most components: no parent re-render rescues it.
const Reader = memo(function Reader() {
  return <Text testID="colour">{useThemeColor(TOKEN)}</Text>;
});

const ValueReader = memo(function ValueReader() {
  return <Text testID="value">{useTheme().backgroundSecondary.val}</Text>;
});

/** Picks the root theme from the stored mode, as the app layout does. */
const Root = () => {
  const mode = useAppStore((state) => state.mode);
  return (
    <TamaguiProvider
      config={config}
      defaultTheme={mode === AppMode.DARK ? AppMode.DARK : AppMode.LIGHT}>
      <Reader />
      <ValueReader />
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

describe("useTheme", () => {
  it("re-reads its values on a change of the app's theme", async () => {
    useAppStore.setState({ mode: AppMode.LIGHT });
    await render(<Root />);

    await act(() => useAppStore.setState({ mode: AppMode.DARK }));

    expect(screen.getByTestId("value")).toHaveTextContent(
      config.themes.dark.backgroundSecondary.val
    );
  });

  // Tamagui's hook misses theme changes, so no file may read it directly.
  it("is the only useTheme the app imports", () => {
    const direct = walkFiles(`${REPO_ROOT}/src`).filter(
      (path) =>
        /\.tsx?$/.test(path) &&
        !path.endsWith("theme-color.ts") &&
        !path.includes("/__tests__/") &&
        /import\s*{[^}]*\buseTheme\b[^}]*}\s*from\s*"tamagui"/.test(readFileSync(path, "utf8"))
    );

    expect(direct).toEqual([]);
  });
});
