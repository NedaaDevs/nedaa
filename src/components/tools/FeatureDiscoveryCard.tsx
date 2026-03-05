import { useTranslation } from "react-i18next";
import { MotiView } from "moti";

import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";
import { X } from "lucide-react-native";
import { useAppStore } from "@/stores/app";
import { useRouter } from "expo-router";

type FeatureCardConfig = {
  id: string;
  titleKey: string;
  descriptionKey: string;
  icon: React.ComponentType<any>;
  route: string;
};

type Props = {
  config: FeatureCardConfig;
};

const FeatureDiscoveryCard = ({ config }: Props) => {
  const { t } = useTranslation();
  const router = useRouter();
  const { dismissedFeatureCards, dismissFeatureCard } = useAppStore();

  if (dismissedFeatureCards.includes(config.id)) return null;

  const handleExplore = () => {
    dismissFeatureCard(config.id);
    router.push(config.route as any);
  };

  const handleDismiss = () => {
    dismissFeatureCard(config.id);
  };

  return (
    <MotiView
      from={{ opacity: 0, translateY: -10 }}
      animate={{ opacity: 1, translateY: 0 }}
      exit={{ opacity: 0, translateY: -10 }}
      transition={{ type: "timing", duration: 250 }}>
      <Box
        marginHorizontal="$2"
        marginBottom="$2"
        padding="$3"
        borderRadius="$4"
        backgroundColor="$backgroundSecondary">
        <HStack justifyContent="space-between" alignItems="flex-start">
          <HStack gap="$3" flex={1} alignItems="center">
            <Box
              width={40}
              height={40}
              borderRadius="$3"
              backgroundColor="$backgroundInteractive"
              alignItems="center"
              justifyContent="center">
              <Icon as={config.icon} size="md" color="$accentPrimary" />
            </Box>
            <VStack flex={1} gap="$0.5">
              <Text size="sm" fontWeight="600" color="$typography">
                {t(config.titleKey)}
              </Text>
              <Text size="xs" color="$typographySecondary" numberOfLines={2}>
                {t(config.descriptionKey)}
              </Text>
            </VStack>
          </HStack>
          <Pressable
            onPress={handleDismiss}
            padding="$1"
            accessibilityRole="button"
            accessibilityLabel={t("a11y.dismiss")}
            hitSlop={8}>
            <Icon as={X} size="sm" color="$typographySecondary" />
          </Pressable>
        </HStack>
        <Box marginTop="$2" alignItems="flex-end">
          <Pressable
            onPress={handleExplore}
            paddingHorizontal="$3"
            paddingVertical="$1.5"
            borderRadius="$3"
            backgroundColor="$accentPrimary"
            accessibilityRole="button"
            accessibilityLabel={t("umrah.featureCard.explore")}>
            <Text size="sm" fontWeight="600" color="white">
              {t("umrah.featureCard.explore")}
            </Text>
          </Pressable>
        </Box>
      </Box>
    </MotiView>
  );
};

export default FeatureDiscoveryCard;
