import { Image } from "react-native";
import { Theme, YStack, XStack } from "tamagui";
import { useTranslation } from "react-i18next";
import { Sunrise, Sparkles } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { formatNumberToLocale } from "@/utils/number";

export type StreakVariant = "fajr" | "athkar";

// Gold-on-dark logomark; mirrors the ayah share card's branded footer.
const LOGO = require("../../assets/images/ios-dark.png");

// Brand palette pinned to literals so the card renders identically regardless of
// the app's active theme (same strategy as the ayah share card's color constants).
const BG = "#222831";
const GOLD = "#E6C469";
const GOLD_SOFT = "rgba(230, 196, 105, 0.14)";
const TEXT = "#FFFFFF";
const TEXT_MUTED = "#8B93A0";
const HAIRLINE = "rgba(255, 255, 255, 0.12)";

const CARD_WIDTH = 300;
const CARD_HEIGHT = 375; // 4:5, sized for social sharing

const ICON: Record<StreakVariant, typeof Sunrise> = {
  fajr: Sunrise,
  athkar: Sparkles,
};

interface StreakShareCardProps {
  variant: StreakVariant;
  count: number;
}

// Shareable streak card — the capture target. Dark Nedaa treatment with a huge
// localized count, a variant title, and a branded footer. Self-wraps in the dark
// theme so token-driven children resolve dark wherever the card is mounted.
const StreakShareCard = ({ variant, count }: StreakShareCardProps) => {
  const { t } = useTranslation();
  const VariantIcon = ICON[variant];
  const formattedCount = formatNumberToLocale(`${count}`);

  return (
    <Theme name="dark">
      <YStack
        width={CARD_WIDTH}
        height={CARD_HEIGHT}
        backgroundColor={BG}
        paddingHorizontal={28}
        paddingVertical={30}
        alignItems="center"
        justifyContent="space-between">
        {/* Streak headline */}
        <YStack flex={1} alignItems="center" justifyContent="center" gap={10}>
          <YStack
            width={60}
            height={60}
            borderRadius={999}
            backgroundColor={GOLD_SOFT}
            alignItems="center"
            justifyContent="center">
            <VariantIcon size={30} color={GOLD} />
          </YStack>

          <Text
            fontSize={13}
            fontWeight="700"
            letterSpacing={2}
            color={GOLD}
            textAlign="center"
            style={{ textTransform: "uppercase" }}>
            {t(`streakShare.${variant}.title`)}
          </Text>

          <Text fontSize={84} fontWeight="800" color={TEXT} textAlign="center">
            {formattedCount}
          </Text>

          <Text fontSize={16} fontWeight="600" color={TEXT_MUTED} textAlign="center">
            {t("streakShare.daysUnit", { count })}
          </Text>
        </YStack>

        {/* Branded footer: hairline, logomark, tagline */}
        <YStack alignItems="center" gap={10} width="100%">
          <YStack width={44} height={1} backgroundColor={HAIRLINE} />
          <XStack alignItems="center" gap={7}>
            <Image source={LOGO} style={{ width: 18, height: 18 }} resizeMode="contain" />
            <Text
              fontSize={10}
              fontWeight="700"
              letterSpacing={1.4}
              color={TEXT_MUTED}
              style={{ textTransform: "uppercase" }}>
              {t("streakShare.tagline")}
            </Text>
          </XStack>
        </YStack>
      </YStack>
    </Theme>
  );
};

export default StreakShareCard;
