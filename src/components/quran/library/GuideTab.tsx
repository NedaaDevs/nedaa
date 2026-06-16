import { useState } from "react";
import { LayoutAnimation, Pressable, ScrollView } from "react-native";
import { XStack, YStack } from "tamagui";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { useQuranChromeColors } from "@/hooks/useQuranChromeColors";
import { useRTL } from "@/contexts/RTLContext";
import { GuideCategory, guideTextKey } from "@/types/guide";
import { GUIDE_CATEGORY_ORDER, guideEntriesByCategory } from "@/services/guide-content";
import { GuideEntryCard } from "@/components/quran/library/GuideEntryCard";

const CATEGORY_LABEL: Record<GuideCategory, string> = {
  [GuideCategory.TAJWEED]: "quran.guide.category.tajweed",
  [GuideCategory.WAQF]: "quran.guide.category.waqf",
  [GuideCategory.SAJDA]: "quran.guide.category.sajda",
};

// Browsable reference guide: tajweed colours, stop signs, and sajda — each a small
// card, grouped into collapsible categories so it's never a wall of text. Lives as
// a tab in the Library hub (app-themed, hence chrome colours).
export const GuideTab = () => {
  const { t, i18n } = useTranslation();
  const chrome = useQuranChromeColors();
  const { isRTL } = useRTL();
  const isArabic = i18n.language === "ar";
  const isLatin = i18n.language === "en" || i18n.language === "ms";
  const cardColors = {
    text: chrome.text,
    subtleText: chrome.subtleText,
    cardBg: chrome.cardBackground,
    cardBorder: chrome.cardBorder,
  };

  // First category open by default; others collapsed to keep it digestible.
  const [open, setOpen] = useState<Set<GuideCategory>>(new Set([GUIDE_CATEGORY_ORDER[0]]));
  const toggle = (cat: GuideCategory) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };
  const Collapsed = isRTL ? ChevronLeft : ChevronRight;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      {GUIDE_CATEGORY_ORDER.map((cat) => {
        const entries = guideEntriesByCategory(cat);
        if (entries.length === 0) return null;
        const isOpen = open.has(cat);
        return (
          <YStack key={cat} gap="$2">
            <Pressable
              onPress={() => toggle(cat)}
              accessibilityRole="button"
              accessibilityState={{ expanded: isOpen }}
              accessibilityLabel={t(CATEGORY_LABEL[cat])}>
              <XStack alignItems="center" gap="$2" paddingVertical="$2">
                <Text
                  fontSize={13}
                  fontWeight="700"
                  color={chrome.text}
                  letterSpacing={0.5}
                  flex={1}>
                  {t(CATEGORY_LABEL[cat]).toUpperCase()}
                </Text>
                <Text fontSize={12} color={chrome.subtleText}>
                  {entries.length}
                </Text>
                {isOpen ? (
                  <ChevronDown size={18} color={chrome.subtleText} />
                ) : (
                  <Collapsed size={18} color={chrome.subtleText} />
                )}
              </XStack>
            </Pressable>

            {isOpen && (
              <YStack gap="$2" paddingBottom="$2">
                {entries.map((entry) => (
                  <GuideEntryCard
                    key={entry.id}
                    entry={entry}
                    colors={cardColors}
                    title={t(guideTextKey(entry.id, "title"))}
                    body={t(guideTextKey(entry.id, "body"))}
                    source={t(guideTextKey(entry.id, "source"), { defaultValue: "" }) || undefined}
                    isArabic={isArabic}
                    isLatin={isLatin}
                  />
                ))}
              </YStack>
            )}
          </YStack>
        );
      })}
    </ScrollView>
  );
};
