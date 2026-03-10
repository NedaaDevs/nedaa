import { ScrollView } from "react-native";
import { useTranslation } from "react-i18next";

import { Background } from "@/components/ui/background";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Icon } from "@/components/ui/icon";
import TopBar from "@/components/TopBar";

import {
  Shirt,
  HardHat,
  EyeOff,
  Hand,
  SprayCan,
  Scissors,
  Minus,
  Target,
  Heart,
  XCircle,
  TreePine,
} from "lucide-react-native";
import { IHRAM_PROHIBITIONS } from "@/constants/UmrahProhibitions";
import type { IhramProhibition } from "@/types/umrah";

const ICON_MAP: Record<string, any> = {
  shirt: Shirt,
  "hard-hat": HardHat,
  "eye-off": EyeOff,
  hand: Hand,
  "spray-can": SprayCan,
  scissors: Scissors,
  minus: Minus,
  target: Target,
  heart: Heart,
  "x-circle": XCircle,
  "tree-pine": TreePine,
};

const GROUP_KEYS: Record<string, string> = {
  men: "umrah.prepare.prohibitions.menOnly",
  women: "umrah.prepare.prohibitions.womenOnly",
  both: "umrah.prepare.prohibitions.both",
};

export default function ProhibitionsScreen() {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === "ar";

  const menOnly = IHRAM_PROHIBITIONS.filter((p) => p.appliesTo === "men");
  const womenOnly = IHRAM_PROHIBITIONS.filter((p) => p.appliesTo === "women");
  const both = IHRAM_PROHIBITIONS.filter((p) => p.appliesTo === "both");

  const groups = [
    { key: "men", items: menOnly },
    { key: "women", items: womenOnly },
    { key: "both", items: both },
  ];

  return (
    <Background>
      <TopBar title="umrah.prepare.prohibitions" backOnClick />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 20 }}>
        {groups.map((group) => (
          <VStack key={group.key} gap="$3" paddingTop="$4">
            <Text size="md" fontWeight="600" color="$typography" accessibilityRole="header">
              {t(GROUP_KEYS[group.key])}
            </Text>
            {group.items.map((item) => (
              <ProhibitionItem key={item.id} item={item} isArabic={isArabic} />
            ))}
          </VStack>
        ))}

        <Box
          padding="$3"
          borderRadius="$3"
          backgroundColor="$backgroundSecondary"
          style={{ borderCurve: "continuous" }}
          accessibilityRole="summary">
          <Text size="xs" color="$typographySecondary">
            {t("umrah.prepare.prohibitions.fidyah")}
          </Text>
        </Box>
      </ScrollView>
    </Background>
  );
}

const ProhibitionItem = ({ item, isArabic }: { item: IhramProhibition; isArabic: boolean }) => {
  const IconComponent = ICON_MAP[item.icon] ?? XCircle;
  const title = isArabic ? item.titleAr : item.titleEn;
  const description = isArabic ? item.descriptionAr : item.descriptionEn;

  return (
    <HStack
      padding="$3"
      borderRadius="$3"
      backgroundColor="$backgroundSecondary"
      style={{ borderCurve: "continuous" }}
      alignItems="center"
      gap="$3"
      accessible
      accessibilityLabel={`${title}: ${description}`}>
      <Box
        width={40}
        height={40}
        borderRadius={20}
        borderWidth={1.5}
        borderColor="$error"
        backgroundColor="$background"
        alignItems="center"
        justifyContent="center"
        importantForAccessibility="no-hide-descendants">
        <Icon as={IconComponent} size="sm" color="$error" />
      </Box>
      <VStack flex={1} gap="$0.5">
        <Text size="sm" fontWeight="600" color="$typography">
          {title}
        </Text>
        <Text size="xs" color="$typographySecondary">
          {description}
        </Text>
      </VStack>
    </HStack>
  );
};
