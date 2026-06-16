import { Pressable, Text as RNText, useWindowDimensions } from "react-native";
import { Sheet, XStack, YStack } from "tamagui";
import { useTranslation } from "react-i18next";

import { Text } from "@/components/ui/text";
import { QURAN_TEXT_FONT, QURAN_THEME_COLORS, toArabicDigits } from "@/constants/Quran";
import { QuranThemeType } from "@/enums/quran";
import { MutashabihatGroup } from "@/types/mutashabihat";
import { MutashabihatNote } from "@/components/quran/sheets/MutashabihatNote";

type Props = {
  group: MutashabihatGroup;
  quranTheme: QuranThemeType;
  isArabic: boolean;
  note: string;
  onChangeNote: (text: string) => void;
  onGoTo: (surah: number, ayah: number, page: number) => void;
  RowChevron: React.ComponentType<{ size?: number; color?: string }>;
};

// In-place comparison of a similar-verse group: each member stacked and
// ref-labelled, with the shared phrase highlighted from its word spans, the
// curated memory rule on top, and a personal note at the bottom.
export const MutashabihatView = ({
  group,
  quranTheme,
  isArabic,
  note,
  onChangeNote,
  onGoTo,
  RowChevron,
}: Props) => {
  const { t } = useTranslation();
  const { height } = useWindowDimensions();
  const c = QURAN_THEME_COLORS[quranTheme];
  const ink = c.textTint ?? c.headerColor;

  return (
    // Sheet.ScrollView (not RN ScrollView) so the inner list scrolls instead of
    // dragging the whole sheet; bounded because groups can have ~12 members and
    // would otherwise overflow the fit-sized sheet.
    <Sheet.ScrollView
      maxHeight={height * 0.6}
      contentContainerStyle={{ gap: 12, paddingTop: 4 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      {group.rule ? (
        <YStack gap="$1">
          <Text fontSize={12} fontWeight="700" color={c.pageNumberColor}>
            {t("quran.mutashabihat.rule")}
          </Text>
          <Text fontSize={14} color={ink}>
            {group.rule}
          </Text>
        </YStack>
      ) : null}

      {group.members.map((m) => {
        const label = isArabic
          ? `${m.surahNameArabic} · ${toArabicDigits(m.ayahNumber)}`
          : `${m.surahNameTransliterated} · ${m.ayahNumber}`;
        // Highlight the shared phrase: words whose 1-based position falls in a span.
        const words = m.text.split(/\s+/);
        const inSharedPhrase = (pos: number) =>
          m.highlightSpans?.some(([from, to]) => pos >= from && pos <= to) ?? false;
        return (
          <Pressable
            key={`${m.surahNumber}:${m.ayahNumber}`}
            onPress={() => onGoTo(m.surahNumber, m.ayahNumber, m.page)}
            accessibilityRole="button"
            accessibilityLabel={`${t("quran.mutashabihat.goto")} ${label}`}>
            <YStack
              gap="$2"
              padding="$3"
              borderRadius={12}
              borderWidth={1}
              borderColor={c.frameColor}
              style={{ backgroundColor: c.innerBackground }}>
              <XStack alignItems="center" gap="$2">
                <Text flex={1} fontSize={12} fontWeight="700" color={c.headerColor}>
                  {label}
                </Text>
                <RowChevron size={18} color={c.pageNumberColor} />
              </XStack>

              <RNText
                style={{
                  fontSize: 21,
                  lineHeight: 42,
                  textAlign: "center",
                  writingDirection: "rtl",
                  fontFamily: QURAN_TEXT_FONT,
                  color: ink,
                }}>
                {words.map((word, j) => (
                  <RNText
                    key={j}
                    style={
                      inSharedPhrase(j + 1)
                        ? { backgroundColor: c.highlightColor, fontWeight: "700" }
                        : undefined
                    }>
                    {word}
                    {j < words.length - 1 ? " " : ""}
                  </RNText>
                ))}
              </RNText>
            </YStack>
          </Pressable>
        );
      })}

      <MutashabihatNote
        key={group.id}
        value={note}
        onChange={onChangeNote}
        ink={ink}
        subtle={c.pageNumberColor}
        border={c.frameColor}
        surface={c.innerBackground}
        isArabic={isArabic}
      />
    </Sheet.ScrollView>
  );
};
