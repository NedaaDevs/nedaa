import { useState } from "react";
import { Pressable } from "react-native";
import { XStack, YStack } from "tamagui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { StatusBar } from "expo-status-bar";
import { ArrowLeft, ArrowRight, Highlighter, Bookmark, List } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { useQuranChromeColors } from "@/hooks/useQuranChromeColors";
import { useRTL } from "@/contexts/RTLContext";
import { useQuranStore } from "@/stores/quran";
import { BrowseIndex } from "@/app/quran-browse";
import { BookmarksTab } from "@/components/quran/library/BookmarksTab";
import { HighlightsTab } from "@/components/quran/library/HighlightsTab";
import { KhatmahTab } from "@/components/quran/library/KhatmahTab";

type LibTab = "highlights" | "bookmarks" | "khatmah" | "index";

// Khatmah is intentionally kept in the union + render switch but omitted from the
// visible tab bar until the feature ships.
const TABS: { id: LibTab; icon: typeof List; labelKey: string }[] = [
  { id: "index", icon: List, labelKey: "quran.library.index" },
  { id: "bookmarks", icon: Bookmark, labelKey: "quran.library.bookmarks" },
  { id: "highlights", icon: Highlighter, labelKey: "quran.library.highlights" },
];

// The reader's Library hub — one screen hosting Highlights, Bookmarks, Khatmah,
// and the Index (browse), switched by a bottom tab bar. Opened from the reader's
// top-bar index icon; the per-ayah action sheet is separate.
const QuranLibraryScreen = () => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const chrome = useQuranChromeColors();
  const { isRTL } = useRTL();
  const setCurrentPage = useQuranStore((s) => s.setCurrentPage);
  const libraryTab = useQuranStore((s) => s.libraryTab);
  const setLibraryTab = useQuranStore((s) => s.setLibraryTab);
  const params = useLocalSearchParams<{ tab?: string }>();
  const deepLinked = TABS.some((x) => x.id === params.tab) ? (params.tab as LibTab) : undefined;

  // Open to the deep-linked tab if given, else the last tab the user left on.
  const [tab, setTab] = useState<LibTab>(deepLinked ?? libraryTab);
  const selectTab = (id: LibTab) => {
    setTab(id);
    setLibraryTab(id);
  };
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  const navigate = (page: number) => {
    setCurrentPage(page);
    router.back();
  };

  const activeLabel = t(TABS.find((x) => x.id === tab)?.labelKey ?? "quran.library.title");

  return (
    <YStack flex={1} backgroundColor="$background" paddingTop={insets.top}>
      <StatusBar style="auto" />

      {/* Header: back + active-tab title */}
      <XStack
        alignItems="center"
        gap="$3"
        paddingHorizontal="$3"
        paddingVertical="$2"
        borderBottomWidth={1}
        borderBottomColor="$borderColor">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
          hitSlop={8}
          style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
          <BackIcon color={chrome.accent} size={24} />
        </Pressable>
        <Text flex={1} fontSize={20} fontWeight="700" color={chrome.text}>
          {activeLabel}
        </Text>
      </XStack>

      {/* Active tab content */}
      <YStack flex={1}>
        {tab === "highlights" && <HighlightsTab onNavigate={navigate} />}
        {tab === "bookmarks" && <BookmarksTab onNavigate={navigate} />}
        {tab === "khatmah" && <KhatmahTab />}
        {tab === "index" && <BrowseIndex onNavigate={navigate} />}
      </YStack>

      {/* Bottom tab bar */}
      <XStack
        borderTopWidth={1}
        borderTopColor="$borderColor"
        backgroundColor="$background"
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
  );
};

export default QuranLibraryScreen;
