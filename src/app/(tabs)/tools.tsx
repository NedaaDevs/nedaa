import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { ScrollView } from "react-native";

import { Background } from "@/components/ui/background";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import TopBar from "@/components/TopBar";

import { Compass, BookOpenCheck } from "lucide-react-native";
import { useUmrahGuideStore } from "@/stores/umrahGuide";
import { useHaptic } from "@/hooks/useHaptic";

type ToolItem = {
  id: string;
  titleKey: string;
  subtitleKey: string;
  icon: React.ComponentType<any>;
  route: string;
  hasActiveBadge?: () => boolean;
};

const TOOLS: ToolItem[] = [
  {
    id: "umrah-guide",
    titleKey: "tools.umrahGuide.title",
    subtitleKey: "tools.umrahGuide.subtitle",
    icon: BookOpenCheck,
    route: "/umrah",
    hasActiveBadge: () => useUmrahGuideStore.getState().activeProgress !== null,
  },
  {
    id: "compass",
    titleKey: "tools.compass.title",
    subtitleKey: "tools.compass.subtitle",
    icon: Compass,
    route: "/(tabs)/compass",
  },
];

export default function ToolsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const selectionHaptic = useHaptic("selection");

  const handleToolPress = async (route: string) => {
    await selectionHaptic();
    router.push(route as any);
  };

  return (
    <Background>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <TopBar title="tools.title" />

        <Box paddingHorizontal="$2" paddingTop="$2">
          <HStack flexWrap="wrap" gap="$2">
            {TOOLS.map((tool) => (
              <Box key={tool.id} width="48.5%">
                <Pressable
                  onPress={() => handleToolPress(tool.route)}
                  padding="$4"
                  borderRadius="$4"
                  backgroundColor="$backgroundSecondary"
                  minHeight={120}
                  justifyContent="space-between"
                  accessibilityRole="button"
                  accessibilityLabel={t(tool.titleKey)}
                  accessibilityHint={t(tool.subtitleKey)}>
                  <Box
                    width={44}
                    height={44}
                    borderRadius="$3"
                    backgroundColor="$backgroundInteractive"
                    alignItems="center"
                    justifyContent="center">
                    <Icon as={tool.icon} size="lg" color="$accentPrimary" />
                  </Box>
                  <VStack marginTop="$3" gap="$0.5">
                    <Text size="md" fontWeight="600" color="$typography">
                      {t(tool.titleKey)}
                    </Text>
                    <Text size="xs" color="$typographySecondary" numberOfLines={2}>
                      {t(tool.subtitleKey)}
                    </Text>
                  </VStack>
                  {tool.hasActiveBadge?.() && (
                    <Box
                      position="absolute"
                      top={12}
                      right={12}
                      width={8}
                      height={8}
                      borderRadius={4}
                      backgroundColor="$accentPrimary"
                    />
                  )}
                </Pressable>
              </Box>
            ))}
          </HStack>
        </Box>
      </ScrollView>
    </Background>
  );
}
