import { useTranslation } from "react-i18next";
import { ScrollView, Alert, Platform } from "react-native";
import { useState, useEffect } from "react";

// Components
import { Box } from "@/components/ui/box";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Badge } from "@/components/ui/badge";
import { Pressable } from "@/components/ui/pressable";
import { Background } from "@/components/ui/background";
import TopBar from "@/components/TopBar";
import AddCustomSoundModal from "@/components/AddCustomSoundModal";

// Icons
import { Plus, Trash2, Info, Volume2, Play, Square } from "lucide-react-native";

// Enums
import { PlatformType } from "@/enums/app";

// Stores
import { useCustomSoundsStore } from "@/stores/customSounds";
import { useNotificationStore } from "@/stores/notification";

// Utils
import {
  deleteCustomSoundFromMediaStore,
  formatFileSize,
  calculateTotalStorage,
  getCustomSoundUsages,
  replaceCustomSoundInSettings,
} from "@/utils/customSoundManager";

// Hooks
import { useHaptic } from "@/hooks/useHaptic";
import { useSoundPreview } from "@/hooks/useSoundPreview";

// Constants
import { NOTIFICATION_TYPE } from "@/constants/Notification";

// Types
import type { AddCustomSoundResult, CustomSound } from "@/types/customSound";

export default function CustomSoundsScreen() {
  const { t } = useTranslation();
  const hapticMedium = useHaptic("medium");
  const hapticSuccess = useHaptic("success");
  const hapticLight = useHaptic("light");
  const { playPreview, stopPreview, isPlayingSound } = useSoundPreview();

  const { customSounds, isInitialized, initialize, addCustomSound, deleteCustomSound } =
    useCustomSoundsStore();
  const { settings, updateSettings, getUsedCustomSounds } = useNotificationStore();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Initialize store on mount
  useEffect(() => {
    if (!isInitialized) {
      initialize();
    }
  }, [isInitialized, initialize]);

  if (Platform.OS !== PlatformType.ANDROID) {
    return (
      <Background>
        <TopBar title={t("notification.customSound.title")} backOnClick />
        <Box flex={1} justifyContent="center" alignItems="center" padding="$6">
          <VStack gap="$3" alignItems="center" maxWidth={400}>
            <Box
              width={80}
              height={80}
              borderRadius={999}
              backgroundColor="$backgroundMuted"
              alignItems="center"
              justifyContent="center">
              <Icon as={Volume2} size="xl" color="$typographySecondary" />
            </Box>
            <Text textAlign="center" color="$typography" fontWeight="500" size="lg">
              {t("notification.customSound.androidOnly")}
            </Text>
          </VStack>
        </Box>
      </Background>
    );
  }

  const totalStorage = calculateTotalStorage(customSounds);

  const handleAddSuccess = async (result: AddCustomSoundResult) => {
    if (result.success) {
      await addCustomSound(result.sound);
      hapticSuccess();
    }
  };

  const handleSoundPreview = async (sound: CustomSound) => {
    hapticLight();
    // Use the first available notification type for preview
    // Custom sounds can be used for any type they're available for
    const previewType = sound.availableFor[0] || NOTIFICATION_TYPE.PRAYER;

    if (isPlayingSound(previewType, sound.id)) {
      await stopPreview();
    } else {
      await playPreview(previewType, sound.id);
    }
  };

  const handleDelete = (id: string) => {
    const sound = customSounds.find((s) => s.id === id);
    if (!sound) return;

    // Check if the custom sound is being used in any notification settings
    const usedSounds = getUsedCustomSounds();
    const isInUse = usedSounds.has(id);
    const usages = getCustomSoundUsages(id, settings);

    if (isInUse && usages.length > 0) {
      // Format usages
      const usageLabels = usages.map((usage) => {
        if (usage.prayerId) {
          // Prayer-specific usage
          return t(`notification.customSound.usage.${usage.type}`, { prayer: usage.prayerId });
        } else {
          // Default usage
          return t(`notification.customSound.usage.default.${usage.type}`);
        }
      });

      // Show alert with auto-replacement option
      Alert.alert(
        t("notification.customSound.deleteInUseTitle"),
        t("notification.customSound.deleteInUseMessage", {
          name: sound.name,
          usages: usageLabels.join(", "),
          replacement: t("notification.sound.makkahAthan1"),
        }),
        [
          {
            text: t("common.cancel"),
            style: "cancel",
          },
          {
            text: t("notification.customSound.replaceAndDelete"),
            style: "destructive",
            onPress: async () => {
              hapticMedium();

              // Replace the custom sound with default sound in settings
              const newSettings = replaceCustomSoundInSettings(id, "makkahAthan1", settings);
              await updateSettings(newSettings);

              // Delete from MediaStore
              await deleteCustomSoundFromMediaStore(sound.contentUri);
              // Delete from store
              await deleteCustomSound(id);

              console.log(`[CustomSounds] Replaced and deleted custom sound: ${sound.name}`);
            },
          },
        ]
      );
    } else {
      // Show regular delete confirmation
      Alert.alert(
        t("notification.customSound.deleteTitle"),
        t("notification.customSound.deleteMessage", { name: sound.name }),
        [
          {
            text: t("common.cancel"),
            style: "cancel",
          },
          {
            text: t("common.delete"),
            style: "destructive",
            onPress: async () => {
              hapticMedium();
              // Delete from MediaStore
              await deleteCustomSoundFromMediaStore(sound.contentUri);
              // Delete from store
              await deleteCustomSound(id);
            },
          },
        ]
      );
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case NOTIFICATION_TYPE.PRAYER:
        return t("notification.type.prayer");
      case NOTIFICATION_TYPE.IQAMA:
        return t("notification.type.iqama");
      case NOTIFICATION_TYPE.PRE_ATHAN:
        return t("notification.type.preAthan");
      default:
        return type;
    }
  };

  return (
    <Background>
      <TopBar title={t("notification.customSound.title")} backOnClick />

      <ScrollView style={{ flex: 1 }}>
        <VStack gap="$4" padding="$4">
          {/* Info Card */}
          <Card
            padding="$5"
            backgroundColor="$backgroundSecondary"
            borderRadius="$6"
            borderWidth={1}
            borderColor="$outline">
            <HStack gap="$3" alignItems="flex-start">
              <Box
                width={40}
                height={40}
                borderRadius={999}
                backgroundColor="$backgroundInfo"
                alignItems="center"
                justifyContent="center">
                <Icon as={Info} size="md" color="$primary" />
              </Box>
              <VStack gap="$2" flex={1}>
                <Text size="sm" color="$typography">
                  {t("notification.customSound.info")}
                </Text>
                <HStack gap="$2" marginTop="$2" flexWrap="wrap">
                  <Badge
                    size="sm"
                    backgroundColor="$backgroundMuted"
                    borderColor="$outline"
                    borderRadius="$4"
                    paddingHorizontal="$3"
                    paddingVertical="$1">
                    <Badge.Text size="sm" color="$typographySecondary" fontWeight="500">
                      {t("notification.customSound.storage")}: {formatFileSize(totalStorage)}
                    </Badge.Text>
                  </Badge>
                  <Badge
                    size="sm"
                    backgroundColor="$backgroundInfo"
                    borderColor="$primary"
                    borderRadius="$4"
                    paddingHorizontal="$3"
                    paddingVertical="$1">
                    <Badge.Text size="sm" color="$primary" fontWeight="500">
                      {customSounds.length} {t("notification.customSound.sounds")}
                    </Badge.Text>
                  </Badge>
                </HStack>
              </VStack>
            </HStack>
          </Card>

          {/* Add Button */}
          <Button
            size="lg"
            backgroundColor="$accentPrimary"
            borderRadius="$6"
            onPress={() => {
              hapticMedium();
              setIsAddModalOpen(true);
            }}>
            <Icon as={Plus} size="md" color="$typographyContrast" />
            <Button.Text color="$typographyContrast" fontWeight="600">
              {t("notification.customSound.addNew")}
            </Button.Text>
          </Button>

          {/* Custom Sounds List */}
          {customSounds.length === 0 ? (
            <Card
              padding="$7"
              backgroundColor="$backgroundSecondary"
              borderRadius="$6"
              borderWidth={1}
              borderColor="$outline">
              <VStack gap="$3" alignItems="center">
                <Box
                  width={64}
                  height={64}
                  borderRadius={999}
                  backgroundColor="$backgroundMuted"
                  alignItems="center"
                  justifyContent="center">
                  <Icon as={Volume2} size="xl" color="$typographySecondary" />
                </Box>
                <Text color="$typography" textAlign="center" fontWeight="500">
                  {t("notification.customSound.empty")}
                </Text>
                <Text size="sm" color="$typographySecondary" textAlign="center">
                  {t("notification.customSound.emptyHint")}
                </Text>
              </VStack>
            </Card>
          ) : (
            <VStack gap="$3">
              {customSounds.map((sound) => (
                <Card
                  key={sound.id}
                  padding="$4"
                  backgroundColor="$backgroundSecondary"
                  borderRadius="$6"
                  borderWidth={1}
                  borderColor="$outline">
                  <HStack gap="$3" alignItems="flex-start">
                    <Pressable
                      onPress={() => handleSoundPreview(sound)}
                      width={48}
                      height={48}
                      borderRadius="$6"
                      backgroundColor="$backgroundInfo"
                      alignItems="center"
                      justifyContent="center">
                      {isPlayingSound(
                        sound.availableFor[0] || NOTIFICATION_TYPE.PRAYER,
                        sound.id
                      ) ? (
                        <Icon as={Square} size="lg" color="$primary" />
                      ) : (
                        <Icon as={Play} size="lg" color="$primary" />
                      )}
                    </Pressable>

                    <VStack gap="$2" flex={1}>
                      <Text bold color="$typography">
                        {sound.name}
                      </Text>
                      <Text size="sm" color="$typographySecondary">
                        {sound.fileName}
                      </Text>
                      <HStack gap="$2" flexWrap="wrap" marginTop="$0.5">
                        {sound.availableFor.map((type) => (
                          <Badge
                            key={type}
                            size="sm"
                            backgroundColor="$backgroundInfo"
                            borderColor="$primary"
                            borderRadius="$2"
                            paddingHorizontal="$2"
                            paddingVertical="$0.5">
                            <Badge.Text size="sm" color="$primary" fontWeight="500">
                              {getTypeLabel(type)}
                            </Badge.Text>
                          </Badge>
                        ))}
                      </HStack>
                      <Text size="sm" color="$typographySecondary" marginTop="$0.5">
                        {formatFileSize(sound.fileSize)}
                      </Text>
                    </VStack>

                    <Button
                      size="sm"
                      variant="outline"
                      borderColor="$error"
                      borderRadius="$4"
                      onPress={() => handleDelete(sound.id)}>
                      <Icon as={Trash2} size="sm" color="$error" />
                    </Button>
                  </HStack>
                </Card>
              ))}
            </VStack>
          )}
        </VStack>
      </ScrollView>

      {/* Add Custom Sound Modal */}
      <AddCustomSoundModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={handleAddSuccess}
      />
    </Background>
  );
}
