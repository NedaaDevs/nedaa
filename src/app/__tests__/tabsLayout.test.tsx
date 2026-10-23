// First, before expo-router's testing library: that library re-mocks Reanimated
// as it loads, and the bar must bind to the mock below, not to its empty one.
import TabsLayout, { TAB_BAR_PART, TAB_ROUTES } from "@/app/(tabs)/_layout";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, parse } from "node:path";
import { useEffect } from "react";
import { StyleSheet, Text, useColorScheme } from "react-native";
import { router, Slot, usePathname } from "expo-router";
import { userEvent } from "@testing-library/react-native";
import { act, fireEvent, renderRouter, screen } from "expo-router/testing-library";

import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { AppLocale, AppMode, HiddenTab, OpeningTab } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useTabBarInset } from "@/hooks/useTabBarInset";
import { useAppStore } from "@/stores/app";
import { useQuranStore } from "@/stores/quran";
import { normalizeRoutePath, REPO_ROOT } from "@/test-helpers/routeTree";
import config from "../../../tamagui.config";
import { isDarkMode } from "@/utils/appearance";
import { getTokenValue, TamaguiProvider } from "tamagui";
import { RTLContext } from "@/contexts/RTLContext";
import { controlProblems } from "@/test-helpers/controls";
import { useTabBarFrameStore } from "@/stores/tabBarFrame";
import { TAB_BAR_ITEM_PART } from "@/components/ui/tab-bar-item";
import { HAPTIC_FEEDBACK } from "@/constants/Haptics";
import { clearHaptics, firedHaptics } from "@/test-helpers/hapticMock";
import { tabBarEdgeGap } from "@/utils/safeArea";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@/hooks/useHaptic", () => jest.requireActual("@/test-helpers/hapticMock"));

const TAB_BAR_TRACK = TAB_BAR_ITEM_PART.TRACK;

// The players reach native audio modules that jest does not load; the bar's frame is what matters.
jest.mock("@/components/athkar/MiniPlayerBar", () => ({ __esModule: true, default: () => null }));
const mockMiniPlayerId = "quran-mini-player-stand-in";
jest.mock("@/components/quran/listen/QuranMiniPlayer", () => {
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return { QuranMiniPlayer: () => <View testID={mockMiniPlayerId} /> };
});

const TABS_GROUP = "(tabs)";
const LAYOUT = "_layout";

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
    useQuranStore.setState({ readerActive: false });
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

  it("reaches every tab the bar hides by link", async () => {
    await renderTabs();

    for (const name of Object.values(HiddenTab)) {
      await act(() => router.navigate(BACK_DESTINATION.TOOLS.href));
      await act(() => router.push(`/${name}`));

      expect(screen.getByTestId("pathname")).toHaveTextContent(`/${name}`);
    }
  });

  // The layout declares one screen for each of TAB_ROUTES.
  it("declares every tab route file", () => {
    const files = readdirSync(join(REPO_ROOT, "src", "app", TABS_GROUP))
      .map((file) => parse(file).name)
      .filter((name) => name !== LAYOUT);

    expect(files.sort()).toEqual([...TAB_ROUTES].sort());
  });

  // The reader is full screen; the tabs would cover the page.
  it("hides the tabs on the Quran tab", async () => {
    await renderTabs();

    await act(() => router.navigate(BACK_DESTINATION.QURAN.href));

    expect(screen.queryAllByRole("tab")).toEqual([]);
  });

  // An open reader hides the mini player on its own tab only; Listen plays on.
  it("shows the Quran mini player on another tab while the reader is open", async () => {
    useQuranStore.setState({ readerActive: true });
    await renderTabs();

    await act(() => router.navigate(BACK_DESTINATION.QURAN.href));
    expect(screen.queryByTestId(mockMiniPlayerId)).toBeNull();

    await act(() => router.navigate(BACK_DESTINATION.HOME.href));
    expect(screen.getByTestId(mockMiniPlayerId)).toBeOnTheScreen();
  });

  const frameStyle = () =>
    Object.assign({}, ...[screen.getByTestId(TAB_BAR_PART.FRAME).props.style].flat(Infinity));

  // The bar floats on every tab that shows it; content runs under it.
  const FLOATING: [string, string][] = [
    ["Today", BACK_DESTINATION.HOME.href],
    ["More", BACK_DESTINATION.TOOLS.href],
    ["Athkar", BACK_DESTINATION.ATHKAR.href],
    ...Object.values(HiddenTab).map((name): [string, string] => [name, `/${name}`]),
  ];
  it.each(FLOATING)("floats the bar over %s", async (_, href) => {
    await renderTabs();
    await act(() => router.navigate(href));

    expect(frameStyle()).toMatchObject({ position: "absolute" });
  });

  // The Quran tab hides the bar, so its mini player sits in the flow.
  it("keeps the frame in the flow on the Quran tab", async () => {
    await renderTabs();
    await act(() => router.navigate(BACK_DESTINATION.QURAN.href));

    expect(frameStyle().position).not.toBe("absolute");
  });

  // The frame spans the screen; only the pill and the players take touches.
  it("passes touches beside the pill to the screen under it", async () => {
    await renderTabs();

    expect(screen.getByTestId(TAB_BAR_PART.FRAME).props.pointerEvents).toBe("box-none");
  });

  it("insets the pill from the screen's edges", async () => {
    await renderTabs();

    expect(StyleSheet.flatten(screen.getByTestId(TAB_BAR_TRACK).props.style)).toMatchObject({
      marginStart: getTokenValue("$3.5", "space"),
      marginEnd: getTokenValue("$3.5", "space"),
      marginBottom: tabBarEdgeGap({ android: false, insetBottom: 0 }),
    });
  });

  it("gives a light selection tap when the tab changes, none on the open tab", async () => {
    await renderTabs();
    clearHaptics();

    await userEvent.setup().press(screen.getByRole("tab", { name: i18n.t("a11y.tab.home") }));
    expect(firedHaptics()).toEqual([]);

    await userEvent.setup().press(screen.getByRole("tab", { name: i18n.t("a11y.tab.tools") }));
    expect(firedHaptics()).toEqual([HAPTIC_FEEDBACK.SELECTION]);
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

const INSET_HOOK = /\buseTabBarInset\(/;
const COMPONENT_IMPORT = /from "@\/(components\/[^"]+)"/g;

/** A route file's source and the component files it imports. */
const routeSources = (name: string): string[] => {
  const route = readFileSync(join(REPO_ROOT, "src", "app", TABS_GROUP, `${name}.tsx`), "utf8");
  const imported = [...route.matchAll(COMPONENT_IMPORT)].flatMap(([, path]) =>
    [`${path}.tsx`, `${path}/index.tsx`]
      .map((file) => join(REPO_ROOT, "src", file))
      .filter((file) => existsSync(file))
      .map((file) => readFileSync(file, "utf8"))
  );
  return [route, ...imported];
};

// The bar floats over every tab that shows it, so each one pads past it.
describe("tab content under the floating bar", () => {
  it.each(TAB_ROUTES.filter((name) => name !== OpeningTab.QURAN))(
    "%s leaves room at its foot for the bar",
    (name) => {
      expect(routeSources(name).some((source) => INSET_HOOK.test(source))).toBe(true);
    }
  );
});
