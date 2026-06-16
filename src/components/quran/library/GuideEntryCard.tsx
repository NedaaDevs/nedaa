import { Text as RNText } from "react-native";
import { View, XStack, YStack } from "tamagui";

import { Text } from "@/components/ui/text";
import { type GuideEntry } from "@/types/guide";
import { QURAN_TEXT_FONT } from "@/constants/Quran";

// Minimal colour set so the same card renders in the Library (app/chrome theme)
// and in the in-reader Guide sheet (reader/paper theme).
export type GuideCardColors = {
  text: `#${string}`;
  subtleText: `#${string}`;
  cardBg: `#${string}`;
  cardBorder: `#${string}`;
};

// One guide entry as a card: a tajweed colour swatch or a waqf/sajda glyph, the
// localized title + body, and — for a dua — the Arabic + transliteration + meaning.
export const GuideEntryCard = ({
  entry,
  title,
  body,
  source,
  isArabic,
  isLatin,
  colors,
}: {
  entry: GuideEntry;
  title: string;
  body: string;
  source?: string;
  isArabic: boolean;
  isLatin: boolean;
  colors: GuideCardColors;
}) => {
  const isDua = !!entry.arabic;
  return (
    <XStack
      gap="$3"
      padding="$3"
      borderRadius={12}
      borderWidth={1}
      borderColor={colors.cardBorder}
      backgroundColor={colors.cardBg}
      alignItems="flex-start">
      {entry.color ? (
        <View
          width={20}
          height={20}
          borderRadius={10}
          marginTop={2}
          style={{ backgroundColor: entry.color }}
        />
      ) : entry.symbol ? (
        <RNText
          style={{
            fontSize: 24,
            minWidth: 30,
            textAlign: "center",
            color: colors.text,
            fontFamily: QURAN_TEXT_FONT,
          }}>
          {entry.symbol}
        </RNText>
      ) : null}

      <YStack flex={1} gap="$1">
        <Text fontSize={15} fontWeight="700" color={colors.text}>
          {title}
        </Text>

        {isDua ? (
          <YStack gap="$1.5" marginTop="$1">
            <RNText
              style={{
                fontSize: 21,
                lineHeight: 40,
                textAlign: "center",
                writingDirection: "rtl",
                color: colors.text,
                fontFamily: QURAN_TEXT_FONT,
              }}>
              {entry.arabic}
            </RNText>
            {isLatin && entry.transliteration ? (
              <Text fontSize={12.5} fontStyle="italic" color={colors.subtleText}>
                {entry.transliteration}
              </Text>
            ) : null}
            {!isArabic ? (
              <Text fontSize={13} lineHeight={19} color={colors.subtleText}>
                {body}
              </Text>
            ) : null}
            {source ? (
              <Text fontSize={11} color={colors.subtleText}>
                {source}
              </Text>
            ) : null}
          </YStack>
        ) : (
          <Text fontSize={13} lineHeight={19} color={colors.subtleText}>
            {body}
          </Text>
        )}
      </YStack>
    </XStack>
  );
};
