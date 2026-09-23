import { useEffect } from "react";
import { Text, useColorScheme } from "react-native";
import { router, Slot, usePathname } from "expo-router";
import { act, renderRouter, screen } from "expo-router/testing-library";

import TabsLayout from "@/app/(tabs)/_layout";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { AppMode } from "@/enums/app";
import { useAppStore } from "@/stores/app";
import { normalizeRoutePath } from "@/test-helpers/routeTree";
import config from "../../../tamagui.config";
import { isDarkMode } from "@/utils/appearance";
import { TamaguiProvider } from "tamagui";
import { RTLContext } from "@/contexts/RTLContext";

// The players reach native audio modules that jest does not load; the bar's frame is what matters.
jest.mock("@/components/athkar/MiniPlayerBar", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/quran/listen/QuranMiniPlayer", () => ({ QuranMiniPlayer: () => null }));

const Pathname = () => <Text testID="pathname">{usePathname()}</Text>;

let toolsMounts = 0;
const ToolsScreen = () => {
  useEffect(() => {
    toolsMounts += 1;
  }, []);
  return null;
};

/** The root's theme choice, as the app layout makes it from the stored mode. */
const ModeTheme = ({ children }: { children: React.ReactNode }) => {
  const mode = useAppStore((state) => state.mode);
  const dark = isDarkMode(mode, useColorScheme());
  return (
    <TamaguiProvider config={config} defaultTheme={dark ? AppMode.DARK : AppMode.LIGHT}>
      <RTLContext value={{ isRTL: false, direction: "ltr" }}>{children}</RTLContext>
    </TamaguiProvider>
  );
};

/** Every background colour the rendered tree paints. */
const backgrounds = (): string[] => {
  const found: string[] = [];
  const walk = (node: ReturnType<typeof screen.toJSON>) => {
    if (!node) return;
    if (Array.isArray(node)) return node.forEach(walk);
    for (const style of [node.props.style].flat(Infinity)) {
      if (style?.backgroundColor) found.push(style.backgroundColor);
    }
    node.children?.forEach((child) => typeof child !== "string" && walk(child));
  };
  walk(screen.toJSON());
  return found;
};

const renderTabs = () =>
  renderRouter(
    {
      _layout: () => (
        <>
          <Slot />
          <Pathname />
        </>
      ),
      "(tabs)/_layout": TabsLayout,
      "(tabs)/index": () => null,
      "(tabs)/athkar": () => null,
      "(tabs)/quran": () => null,
      "(tabs)/qada": () => null,
      "(tabs)/tools": ToolsScreen,
      "(tabs)/compass": () => null,
      "(tabs)/settings": () => null,
    },
    {
      initialUrl: "/",
      wrapper: ModeTheme,
    }
  );

describe("tabs layout", () => {
  beforeEach(() => {
    toolsMounts = 0;
    useAppStore.setState({ mode: AppMode.LIGHT });
  });

  // A new appearance restyles the tabs in place; rebuilding them reran every screen.
  it("remounts no tab screen when the appearance changes", async () => {
    await renderTabs();
    await act(() => router.navigate(BACK_DESTINATION.TOOLS.href));
    const mounted = toolsMounts;

    await act(() => useAppStore.setState({ mode: AppMode.DARK }));

    expect(toolsMounts).toBe(mounted);
    expect(screen.getByTestId("pathname")).toHaveTextContent(
      normalizeRoutePath(BACK_DESTINATION.TOOLS.href)
    );
  });

  it("paints the tab bar in the new appearance's colours", async () => {
    await renderTabs();

    await act(() => useAppStore.setState({ mode: AppMode.DARK }));

    expect(backgrounds()).toContain(config.themes.dark.backgroundSecondary.val);
    expect(backgrounds()).not.toContain(config.themes.light.backgroundSecondary.val);
  });
});
