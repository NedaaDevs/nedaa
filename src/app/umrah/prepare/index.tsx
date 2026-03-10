import { ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";

import { Background } from "@/components/ui/background";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";
import TopBar from "@/components/TopBar";

import { Shirt, MapPin, ShieldAlert } from "lucide-react-native";
import { useHaptic } from "@/hooks/useHaptic";

export default function PrepareIndexScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const selectionHaptic = useHaptic("selection");

  const cards = [
    {
      titleKey: "umrah.prepare.ihram",
      subtitleKey: "umrah.prepare.ihramSubtitle",
      icon: Shirt,
      route: "/umrah/prepare/ihram",
    },
    {
      titleKey: "umrah.prepare.miqat",
      subtitleKey: "umrah.prepare.miqatSubtitle",
      icon: MapPin,
      route: "/umrah/prepare/miqat",
    },
    {
      titleKey: "umrah.prepare.prohibitions",
      subtitleKey: "umrah.prepare.prohibitionsSubtitle",
      icon: ShieldAlert,
      route: "/umrah/prepare/prohibitions",
    },
  ] as const;

  const handleCardPress = async (route: string) => {
    await selectionHaptic();
    router.push(route as any);
  };

  return (
    <Background>
      <TopBar title="umrah.prepare.title" backOnClick />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 16 }}>
        <VStack gap="$3" paddingTop="$4">
          {cards.map((card) => (
            <Pressable
              key={card.route}
              onPress={() => handleCardPress(card.route)}
              accessibilityRole="button"
              accessibilityLabel={`${t(card.titleKey)}, ${t(card.subtitleKey)}`}
              accessibilityHint={t("a11y.umrah.opensGuideHint")}>
              <HStack
                padding="$4"
                borderRadius="$3"
                backgroundColor="$backgroundSecondary"
                style={{ borderCurve: "continuous" }}
                alignItems="center"
                gap="$3">
                <Box
                  width={44}
                  height={44}
                  borderRadius={22}
                  borderWidth={1.5}
                  borderColor="$accentPrimary"
                  backgroundColor="$background"
                  alignItems="center"
                  justifyContent="center">
                  <Icon as={card.icon} size="md" color="$accentPrimary" />
                </Box>
                <VStack flex={1} gap="$0.5">
                  <Text size="md" fontWeight="600" color="$typography">
                    {t(card.titleKey)}
                  </Text>
                  <Text size="sm" color="$typographySecondary">
                    {t(card.subtitleKey)}
                  </Text>
                </VStack>
              </HStack>
            </Pressable>
          ))}
        </VStack>
      </ScrollView>
    </Background>
  );
}
