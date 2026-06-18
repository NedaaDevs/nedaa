import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
  type ReactNode,
} from "react";
import { BackHandler, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { XStack, YStack } from "tamagui";
import { Bell, Bookmark, BookOpen, Highlighter, List, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { Text } from "@/components/ui/text";
import { useQuranChromeColors } from "@/hooks/useQuranChromeColors";
import { useQuranStore } from "@/stores/quran";
import { useRTL } from "@/contexts/RTLContext";
import { BrowseIndex } from "@/app/quran-browse";
import { BookmarksTab } from "@/components/quran/library/BookmarksTab";
import { HighlightsTab } from "@/components/quran/library/HighlightsTab";
import { KhatmahTab } from "@/components/quran/library/KhatmahTab";
import { GuideTab } from "@/components/quran/library/GuideTab";
import { RemindersTab } from "@/components/quran/library/RemindersTab";

export type LibTab = "highlights" | "bookmarks" | "khatmah" | "index" | "reminders" | "guide";
export type ReaderLibraryDrawerHandle = { open: (tab?: LibTab) => void };

// Khatmah stays in the render switch but off the visible tab bar until it ships.
const TABS: { id: LibTab; icon: typeof List; labelKey: string }[] = [
  { id: "index", icon: List, labelKey: "quran.library.index" },
  { id: "bookmarks", icon: Bookmark, labelKey: "quran.library.bookmarks" },
  { id: "highlights", icon: Highlighter, labelKey: "quran.library.highlights" },
  { id: "reminders", icon: Bell, labelKey: "quran.library.reminders" },
  { id: "guide", icon: BookOpen, labelKey: "quran.library.guide" },
];

const WIDTH_FRACTION = 0.9;
const SPRING = { damping: 26, stiffness: 240, overshootClamping: true } as const;

// The reader's Library as a leading-edge side drawer over the page, opened from the
// chrome to a tab and closed via the scrim or Android back. Opening is button-only
// on purpose: a horizontal edge-swipe would fight the reader's page-turn gesture.
// Wrap the reader: <ReaderLibraryDrawer ref={…}>{reader}</ReaderLibraryDrawer>.
const ReaderLibraryDrawer = forwardRef<ReaderLibraryDrawerHandle, { children: ReactNode }>(
  ({ children }, ref) => {
    const { t } = useTranslation();
    const { isRTL } = useRTL();
    const { width } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const chrome = useQuranChromeColors();
    const setCurrentPage = useQuranStore((s) => s.setCurrentPage);
    const libraryTab = useQuranStore((s) => s.libraryTab);
    const setLibraryTab = useQuranStore((s) => s.setLibraryTab);

    const drawerW = Math.round(width * WIDTH_FRACTION);
    // translateX is physical (RN doesn't RTL-flip transforms), so offset off-screen
    // toward whichever edge `start` anchored the panel to.
    const hiddenX = isRTL ? drawerW : -drawerW;
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState<LibTab>(libraryTab);
    const progress = useSharedValue(0); // 0 closed → 1 open

    const close = useCallback(() => {
      progress.set(withSpring(0, SPRING));
      setOpen(false);
    }, [progress]);

    useImperativeHandle(
      ref,
      () => ({
        open: (next?: LibTab) => {
          if (next) {
            setTab(next);
            setLibraryTab(next);
          }
          progress.set(withSpring(1, SPRING));
          setOpen(true);
        },
      }),
      [progress, setLibraryTab]
    );

    // Android back closes the drawer instead of leaving the reader.
    useEffect(() => {
      if (!open) return;
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        close();
        return true;
      });
      return () => sub.remove();
    }, [open, close]);

    const selectTab = (id: LibTab) => {
      setTab(id);
      setLibraryTab(id);
    };
    const navigate = (page: number) => {
      setCurrentPage(page);
      close();
    };

    const panelStyle = useAnimatedStyle(() => ({
      transform: [
        { translateX: interpolate(progress.get(), [0, 1], [hiddenX, 0], Extrapolation.CLAMP) },
      ],
    }));
    const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.get() * 0.4 }));

    const activeLabel = t(TABS.find((x) => x.id === tab)?.labelKey ?? "quran.library.title");

    return (
      <>
        <YStack flex={1}>{children}</YStack>

        <Animated.View
          pointerEvents={open ? "auto" : "none"}
          style={[StyleSheet.absoluteFill, { backgroundColor: "#000", zIndex: 30 }, scrimStyle]}>
          <Pressable style={{ flex: 1 }} onPress={close} accessibilityRole="button" />
        </Animated.View>

        <Animated.View
          pointerEvents={open ? "auto" : "none"}
          style={[
            {
              position: "absolute",
              top: 0,
              bottom: 0,
              start: 0,
              width: drawerW,
              zIndex: 40,
              backgroundColor: chrome.background,
            },
            panelStyle,
          ]}>
          <YStack flex={1} paddingTop={insets.top}>
            <XStack
              alignItems="center"
              gap="$3"
              paddingHorizontal="$3"
              paddingVertical="$2"
              borderBottomWidth={1}
              borderBottomColor={chrome.cardBorder}>
              <Text flex={1} fontSize={20} fontWeight="700" color={chrome.text}>
                {activeLabel}
              </Text>
              <Pressable
                onPress={close}
                accessibilityRole="button"
                accessibilityLabel={t("common.close")}
                hitSlop={8}
                style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
                <X color={chrome.accent} size={24} />
              </Pressable>
            </XStack>

            <YStack flex={1}>
              {tab === "highlights" && <HighlightsTab onNavigate={navigate} />}
              {tab === "bookmarks" && <BookmarksTab onNavigate={navigate} />}
              {tab === "khatmah" && <KhatmahTab />}
              {tab === "index" && <BrowseIndex onNavigate={navigate} />}
              {tab === "reminders" && <RemindersTab />}
              {tab === "guide" && <GuideTab />}
            </YStack>

            <XStack
              borderTopWidth={1}
              borderTopColor={chrome.cardBorder}
              backgroundColor={chrome.background}
              paddingTop="$2"
              style={{ paddingBottom: Math.max(insets.bottom, 8) }}>
              {TABS.map(({ id, icon: Icon, labelKey }) => {
                const active = id === tab;
                const color = active ? chrome.accent : chrome.subtleText;
                return (
                  <Pressable
                    key={id}
                    onPress={() => selectTab(id)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={t(labelKey)}
                    style={{
                      flex: 1,
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 3,
                      minHeight: 48,
                    }}>
                    <Icon color={color} size={22} strokeWidth={active ? 2.4 : 1.8} />
                    <Text fontSize={11} fontWeight={active ? "700" : "500"} color={color}>
                      {t(labelKey)}
                    </Text>
                  </Pressable>
                );
              })}
            </XStack>
          </YStack>
        </Animated.View>
      </>
    );
  }
);

ReaderLibraryDrawer.displayName = "ReaderLibraryDrawer";

export default ReaderLibraryDrawer;
