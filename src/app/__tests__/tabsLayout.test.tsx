import { useEffect } from "react";
import { Text, useColorScheme } from "react-native";
import { router, Slot, usePathname } from "expo-router";
import { userEvent } from "@testing-library/react-native";
import { act, fireEvent, renderRouter, screen } from "expo-router/testing-library";

import TabsLayout, { TAB_BAR_PART } from "@/app/(tabs)/_layout";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { AppLocale, AppMode } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useTabBarInset } from "@/hooks/useTabBarInset";
import { useAppStore } from "@/stores/app";
import { normalizeRoutePath } from "@/test-helpers/routeTree";
import config from "../../../tamagui.config";
import { isDarkMode } from "@/utils/appearance";
import { TamaguiProvider } from "tamagui";
import { RTLContext } from "@/contexts/RTLContext";
import { controlProblems } from "@/test-helpers/controls";
import { useTabBarFrameStore } from "@/stores/tabBarFrame";

// The players reach native audio modules that jest does not load; the bar's frame is what matters.
jest.mock("@/components/athkar/MiniPlayerBar", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/quran/listen/QuranMiniPlayer", () => ({ QuranMiniPlayer: () => null }));

const Pathname = () => <Text testID="pathname">{usePathname()}</Text>;

/** Today's content, reporting the room it leaves for the bar. */
const TodayStandIn = () => <Text testID="inset">{useTabBarInset()}</Text>;

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
      "(tabs)/index": TodayStandIn,
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
    useAppStore.setState({ mode: AppMode.LIGHT, locale: AppLocale.EN });
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

    expect(backgrounds()).toContain(config.themes.dark.bar.val);
    expect(backgrounds()).not.toContain(config.themes.light.bar.val);
  });

  const tabNames = () => screen.queryAllByRole("tab").map((node) => node.props.accessibilityLabel);

  // Settings sits under More; the bar keeps the four places a day is spent in.
  it("offers Today, Quran, Athkar and More, in that order", async () => {
    await renderTabs();

    expect(tabNames()).toEqual([
      i18n.t("a11y.tab.home"),
      i18n.t("a11y.tab.quran"),
      i18n.t("a11y.tab.athkar"),
      i18n.t("a11y.tab.tools"),
    ]);
  });

  it("gives every tab a role, a name and a 44pt target", async () => {
    await renderTabs();

    expect(controlProblems()).toEqual([]);
  });

  it("drops Athkar where the locale has none", async () => {
    useAppStore.setState({ locale: AppLocale.MS });
    await renderTabs();

    expect(tabNames()).not.toContain(i18n.t("a11y.tab.athkar"));
    expect(tabNames()).toHaveLength(3);
  });

  it("marks the open tab selected", async () => {
    await renderTabs();

    expect(screen.getByRole("tab", { name: i18n.t("a11y.tab.home"), selected: true })).toBeTruthy();
    expect(screen.getAllByRole("tab", { selected: false })).toHaveLength(3);
  });

  it("opens a tab when pressed", async () => {
    await renderTabs();

    await userEvent.setup().press(screen.getByRole("tab", { name: i18n.t("a11y.tab.tools") }));

    expect(screen.getByTestId("pathname")).toHaveTextContent(
      normalizeRoutePath(BACK_DESTINATION.TOOLS.href)
    );
  });

  // The reader is full screen; the tabs would cover the page.
  it("hides the tabs on the Quran tab", async () => {
    await renderTabs();

    await act(() => router.navigate(BACK_DESTINATION.QURAN.href));

    expect(screen.queryAllByRole("tab")).toEqual([]);
  });

  const frameStyle = () =>
    Object.assign({}, ...[screen.getByTestId(TAB_BAR_PART.FRAME).props.style].flat(Infinity));

  // The sky runs under the bar on the screens that draw it, as the design does.
  it.each([
    ["Today", BACK_DESTINATION.HOME.href],
    ["More", BACK_DESTINATION.TOOLS.href],
  ])("floats the bar over %s", async (_, href) => {
    await renderTabs();
    await act(() => router.navigate(href));

    expect(frameStyle()).toMatchObject({ position: "absolute" });
  });

  // A tab without the sky keeps the bar in the flow.
  it("keeps the bar in the flow on a tab without the sky", async () => {
    await renderTabs();
    await act(() => router.navigate(BACK_DESTINATION.ATHKAR.href));

    expect(frameStyle().position).not.toBe("absolute");
  });

  it("tells the screen how much room the floating bar needs", async () => {
    await renderTabs();

    await act(() =>
      fireEvent(screen.getByTestId(TAB_BAR_PART.FRAME), "layout", {
        nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 92 } },
      })
    );

    expect(screen.getByTestId("inset")).toHaveTextContent("92");
  });

  // The toast lives at the root, outside the tabs, so the bar reports there too.
  it("tells the root how tall the bar is", async () => {
    await renderTabs();

    await act(() =>
      fireEvent(screen.getByTestId(TAB_BAR_PART.FRAME), "layout", {
        nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 92 } },
      })
    );

    expect(useTabBarFrameStore.getState().height).toBe(92);
  });
});
