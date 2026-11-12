import type { ComponentProps, ReactElement } from "react";
import { Platform, StyleSheet, View } from "react-native";
import type { Stack } from "expo-router";
import type { Tabs } from "expo-router/js-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useThemeColor } from "@/components/ui/theme-color";
import { BACK_DESTINATION, TAB_GROUP } from "@/constants/BackDestinations";
import { PRESENTATION } from "@/constants/Navigation";
import { QURAN_THEME_COLORS } from "@/constants/Quran";
import { PlatformType } from "@/enums/app";
import { useResolvedQuranTheme } from "@/hooks/useResolvedQuranTheme";
import { useQuranStore } from "@/stores/quran";
import { isSkyRoute } from "@/utils/safeArea";

const SCREEN_TOP_EDGE_ID = "screen-top-edge";

/** The test id of the edge around the screen the navigator names `route`. */
export const screenTopEdgeId = (route: string): string => `${route}-${SCREEN_TOP_EDGE_ID}`;

type EdgeProps = {
  /** The screen's name, as `BACK_DESTINATION` spells it. */
  route: string;
  /** The screen draws under the status bar and pads its own top. */
  open: boolean;
  /** What shows behind the status bar; the app's background if not given. */
  band?: string;
  children: ReactElement;
};

// One element in both states, so opening or padding never remounts the screen.
const TopEdge = ({ route, open, band, children }: EdgeProps) => {
  const { top } = useSafeAreaInsets();
  const background = useThemeColor("$background");
  return (
    <View
      testID={screenTopEdgeId(route)}
      style={
        open ? styles.fill : [styles.fill, { paddingTop: top, backgroundColor: band ?? background }]
      }>
      {children}
    </View>
  );
};

// Android's reader is full-bleed so hiding the bars never reflows the page;
// iOS keeps the inset, which stays whether the bar shows or not.
const ReaderTopEdge = ({ children }: { children: ReactElement }) => {
  const readerActive = useQuranStore((s) => s.readerActive);
  const quranTheme = useResolvedQuranTheme();
  return (
    <TopEdge
      route={BACK_DESTINATION.QURAN.route}
      open={readerActive && Platform.OS === PlatformType.ANDROID}
      band={readerActive ? QURAN_THEME_COLORS[quranTheme].background : undefined}>
      {children}
    </TopEdge>
  );
};

type RootScreenLayout = NonNullable<ComponentProps<typeof Stack>["screenLayout"]>;
type TabScreenLayout = NonNullable<ComponentProps<typeof Tabs>["screenLayout"]>;

/** The root stack's screens; the tabs pad each tab themselves. */
export const rootScreenLayout: RootScreenLayout = ({ route, options, children }) =>
  route.name === TAB_GROUP ? (
    children
  ) : (
    <TopEdge
      route={route.name}
      open={isSkyRoute(route.name) || options.presentation === PRESENTATION.FULL_SCREEN_MODAL}>
      {children}
    </TopEdge>
  );

export const tabScreenLayout: TabScreenLayout = ({ route, children }) => {
  const name = `${TAB_GROUP}/${route.name}`;
  return name === BACK_DESTINATION.QURAN.route ? (
    <ReaderTopEdge>{children}</ReaderTopEdge>
  ) : (
    <TopEdge route={name} open={isSkyRoute(name)}>
      {children}
    </TopEdge>
  );
};

const styles = StyleSheet.create({ fill: { flex: 1 } });
