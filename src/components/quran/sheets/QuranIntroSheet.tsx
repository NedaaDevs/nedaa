import { Pressable } from "react-native";
import { XStack, YStack } from "tamagui";
import { useTranslation } from "react-i18next";
import {
  MousePointerClick,
  Hand,
  Layers,
  Highlighter,
  Bookmark,
} from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { QURAN_THEME_COLORS } from "@/constants/Quran";
import { QuranThemeType } from "@/enums/quran";
import ReaderSheet from "@/components/quran/sheets/ReaderSheet";

type Tip = { id: string; Icon: React.ComponentType<{ size?: number; color?: string }> };

// The reader's gestures aren't discoverable on their own, so this walkthrough
// names them once: tap, long-press, similar verses, highlight, bookmark.
const TIPS: Tip[] = [
  { id: "tap", Icon: MousePointerClick },
  { id: "longPress", Icon: Hand },
  { id: "similar", Icon: Layers },
  { id: "highlight", Icon: Highlighter },
  { id: "bookmark", Icon: Bookmark },
];

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

      <YStack gap="$3" paddingTop="$2">
        {TIPS.map(({ id, Icon }) => (
          <XStack key={id} gap="$3" alignItems="center">
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
