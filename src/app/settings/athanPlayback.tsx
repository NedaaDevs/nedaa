import { useTranslation } from "react-i18next";
import { ScrollView } from "react-native";
import { router } from "expo-router";

// Components
import { Box } from "@/components/ui/box";
import { Card } from "@/components/ui/card";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Background } from "@/components/ui/background";
import TopBar from "@/components/TopBar";

// Icons
import { Play, Volume1, VolumeX } from "lucide-react-native";

// Hooks
import { useNotificationSettings } from "@/hooks/useNotificationSettings";
import { useHaptic } from "@/hooks/useHaptic";

const AthanPlaybackSettings = () => {
  const { t } = useTranslation();
  const hapticSelection = useHaptic("selection");
  const hapticMedium = useHaptic("medium");

  const {
    fullAthanPlayback,
    athanAudioStream,
    updateFullAthanPlayback,
    updateAthanAudioStream,
    fullIqamaPlayback,
    iqamaAudioStream,
    updateFullIqamaPlayback,
    updateIqamaAudioStream,
  } = useNotificationSettings();

  return (
    <Background>
      <TopBar title="notification.athanPlayback.title" backOnClick />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}>
        <VStack flex={1} gap="$3" paddingTop="$4">
          {/* Full Athan Playback */}
          <Card marginHorizontal="$4">
            <HStack justifyContent="space-between" alignItems="center">
              <HStack gap="$3" alignItems="center" flex={1}>
                <Icon color="$primary" size="lg" as={Play} />
                <VStack flex={1} gap="$1">
                  <Text size="md" fontWeight="600" color="$typography">
                    {t("notification.fullAthanPlayback")}
                  </Text>
                  <Text size="xs" color="$typographySecondary">
                    {t("notification.fullAthanPlayback.description")}
                  </Text>
                </VStack>
              </HStack>
              <Switch
                value={fullAthanPlayback}
                onValueChange={(value) => {
                  hapticSelection();
                  updateFullAthanPlayback(value);
                }}
                size="md"
                accessibilityLabel={t("notification.fullAthanPlayback")}
              />
            </HStack>
          </Card>

          {/* Respect Silent Mode (only when full athan is on) */}
          {fullAthanPlayback && (
            <Card marginHorizontal="$4">
              <HStack justifyContent="space-between" alignItems="center">
                <HStack gap="$3" alignItems="center" flex={1}>
                  <Icon color="$primary" size="lg" as={VolumeX} />
                  <VStack flex={1} gap="$1">
                    <Text size="md" fontWeight="600" color="$typography">
                      {t("notification.respectSilentMode")}
                    </Text>
                    <Text size="xs" color="$typographySecondary">
                      {t("notification.respectSilentMode.description")}
                    </Text>
                  </VStack>
                </HStack>
                <Switch
                  value={athanAudioStream === "ringer"}
                  onValueChange={(value) => {
                    hapticSelection();
                    updateAthanAudioStream(value ? "ringer" : "media");
                  }}
                  size="md"
                  accessibilityLabel={t("notification.respectSilentMode")}
                />
              </HStack>
            </Card>
          )}

          {/* Full Iqama Playback */}
          <Card marginHorizontal="$4">
            <HStack justifyContent="space-between" alignItems="center">
              <HStack gap="$3" alignItems="center" flex={1}>
                <Icon color="$primary" size="lg" as={Play} />
                <VStack flex={1} gap="$1">
                  <Text size="md" fontWeight="600" color="$typography">
                    {t("notification.fullIqamaPlayback")}
                  </Text>
                  <Text size="xs" color="$typographySecondary">
                    {t("notification.fullIqamaPlayback.description")}
                  </Text>
                </VStack>
              </HStack>
              <Switch
                value={fullIqamaPlayback}
                onValueChange={(value) => {
                  hapticSelection();
                  updateFullIqamaPlayback(value);
                }}
                size="md"
                accessibilityLabel={t("notification.fullIqamaPlayback")}
              />
            </HStack>
          </Card>

          {/* Iqama Respect Silent Mode */}
          {fullIqamaPlayback && (
            <Card marginHorizontal="$4">
              <HStack justifyContent="space-between" alignItems="center">
                <HStack gap="$3" alignItems="center" flex={1}>
                  <Icon color="$primary" size="lg" as={VolumeX} />
                  <VStack flex={1} gap="$1">
                    <Text size="md" fontWeight="600" color="$typography">
                      {t("notification.iqamaRespectSilentMode")}
                    </Text>
                    <Text size="xs" color="$typographySecondary">
                      {t("notification.iqamaRespectSilentMode.description")}
                    </Text>
                  </VStack>
                </HStack>
                <Switch
                  value={iqamaAudioStream === "ringer"}
                  onValueChange={(value) => {
                    hapticSelection();
                    updateIqamaAudioStream(value ? "ringer" : "media");
                  }}
                  size="md"
                  accessibilityLabel={t("notification.iqamaRespectSilentMode")}
                />
              </HStack>
            </Card>
          )}

          {/* Custom Sounds */}
          <Box marginHorizontal="$4">
            <Button
              size="lg"
              backgroundColor="$accentPrimary"
              borderRadius="$6"
              onPress={() => {
                hapticMedium();
                router.push("/settings/customSounds");
              }}>
              <Icon as={Volume1} size="md" color="$typographyContrast" />
              <Button.Text color="$typographyContrast" fontWeight="600">
                {t("notification.customSound.manage")}
              </Button.Text>
            </Button>
          </Box>
        </VStack>
      </ScrollView>
    </Background>
  );
};

export default AthanPlaybackSettings;
