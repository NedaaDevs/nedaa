import { Pressable, Text as RNText } from "react-native";
import { XStack, YStack } from "tamagui";
import { useTranslation } from "react-i18next";
import { MousePointerClick, Hand } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { QURAN_THEME_COLORS, QURAN_TEXT_FONT, BOOKMARK_COLORS, toArabicDigits } from "@/constants/Quran";
import { QuranThemeType, BookmarkColor } from "@/enums/quran";
import ReaderSheet from "@/components/quran/sheets/ReaderSheet";
import RibbonGlyph from "@/components/quran/RibbonGlyph";

// The reader's gestures aren't discoverable on their own, so this walkthrough
// names them once and shows what each looks like on the page.
const TIP_IDS = ["tap", "longPress", "similar", "highlight", "bookmark"] as const;

// First-open reader walkthrough (also reopenable from the reader's help icon).
const QuranIntroSheet = ({
  quranTheme,
  onClose,
}: {
  quranTheme: QuranThemeType;
  onClose: () => void;
}) => {
  const { t } = useTranslation();
  const c = QURAN_THEME_COLORS[quranTheme];
  const ink = c.textTint ?? c.headerColor;
  const sampleNum = toArabicDigits(2);

  // A small real-looking visual per tip, so the page teaches what to look for —
  // most importantly the gold dot above an ayah number that marks similar verses.
  const visual = (id: (typeof TIP_IDS)[number]) => {
    if (id === "similar") {
      return (
        <YStack alignItems="center" justifyContent="center">
          <YStack
            width={6}
            height={6}
            borderRadius={3}
            marginBottom={2}
            style={{ backgroundColor: c.markerColor }}
          />
          <RNText style={{ fontSize: 18, fontFamily: QURAN_TEXT_FONT, color: c.markerColor }}>
            {`﴿${sampleNum}﴾`}
          </RNText>
        </YStack>
      );
    }
    if (id === "highlight") {
      return (
        <RNText
          style={{
            fontSize: 17,
            fontFamily: QURAN_TEXT_FONT,
            color: ink,
            backgroundColor: c.highlightColor,
            paddingHorizontal: 5,
            paddingVertical: 2,
            borderRadius: 4,
          }}>
          كَلِمَة
        </RNText>
      );
    }
    if (id === "bookmark") {
      return <RibbonGlyph size={26} color={BOOKMARK_COLORS[BookmarkColor.GARNET].solid} />;
    }
    const Icon = id === "tap" ? MousePointerClick : Hand;
    return (
      <YStack
        width={38}
        height={38}
        borderRadius={19}
        alignItems="center"
        justifyContent="center"
        borderWidth={1}
        borderColor={c.frameColor}
        style={{ backgroundColor: c.innerBackground }}>
        <Icon size={18} color={c.headerColor} />
      </YStack>
    );
  };

  return (
    <ReaderSheet onClose={onClose} quranTheme={quranTheme}>
      <YStack gap="$2" paddingBottom="$2">
        <Text fontSize={18} fontWeight="700" color={c.headerColor}>
          {t("quran.intro.title")}
        </Text>
        <Text fontSize={13} color={c.pageNumberColor}>
          {t("quran.intro.subtitle")}
        </Text>
      </YStack>

      <YStack gap="$3.5" paddingTop="$2">
        {TIP_IDS.map((id) => (
          <XStack key={id} gap="$3" alignItems="center">
            <YStack width={46} alignItems="center" justifyContent="center">
              {visual(id)}
            </YStack>
            <YStack flex={1} gap="$0.5">
              <Text fontSize={15} fontWeight="700" color={ink}>
                {t(`quran.intro.${id}.title`)}
              </Text>
              <Text fontSize={13} lineHeight={18} color={c.pageNumberColor}>
                {t(`quran.intro.${id}.body`)}
              </Text>
            </YStack>
          </XStack>
        ))}
      </YStack>

      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t("quran.intro.gotIt")}
        style={{ marginTop: 20 }}>
        <YStack
          minHeight={48}
          borderRadius={12}
          alignItems="center"
          justifyContent="center"
          style={{ backgroundColor: c.headerColor }}>
          <Text fontSize={15} fontWeight="700" color={c.background}>
            {t("quran.intro.gotIt")}
          </Text>
        </YStack>
      </Pressable>
    </ReaderSheet>
  );
};

export default QuranIntroSheet;
