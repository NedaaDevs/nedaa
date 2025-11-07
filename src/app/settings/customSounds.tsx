import { useTranslation } from "react-i18next";
import { ScrollView, Alert, Platform } from "react-native";
import { useState, useEffect } from "react";

// Components
import { Box } from "@/components/ui/box";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Badge, BadgeText } from "@/components/ui/badge";
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
        <Box className="flex-1 justify-center items-center p-6">
          <VStack space="md" className="items-center max-w-md">
            <Box className="w-20 h-20 rounded-full bg-background-muted items-center justify-center">
              <Icon as={Volume2} size="xl" className="text-typography-secondary" />
            </Box>
            <Text className="text-center text-typography font-medium text-lg">
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

      <ScrollView className="flex-1">
        <VStack space="lg" className="p-4">
          {/* Info Card */}
          <Card className="p-5 bg-background-secondary rounded-xl border border-outline shadow-sm">
            <HStack space="md" className="items-start">
              <Box className="w-10 h-10 rounded-full bg-background-info items-center justify-center">
                <Icon as={Info} size="md" className="text-primary" />
              </Box>
              <VStack space="sm" className="flex-1">
                <Text size="sm" className="text-typography leading-relaxed">
                  {t("notification.customSound.info")}
                </Text>
                <HStack space="sm" className="mt-2 flex-wrap">
                  <Badge
                    size="sm"
                    className="bg-background-muted border-outline rounded-lg px-3 py-1.5">
                    <BadgeText size="sm" className="text-typography-secondary font-medium">
                      {t("notification.customSound.storage")}: {formatFileSize(totalStorage)}
                    </BadgeText>
                  </Badge>
                  <Badge
                    size="sm"
                    className="bg-primary/10 border-primary/20 rounded-lg px-3 py-1.5">
                    <BadgeText size="sm" className="text-primary font-medium">
                      {customSounds.length} {t("notification.customSound.sounds")}
                    </BadgeText>
                  </Badge>
                </HStack>
              </VStack>
            </HStack>
          </Card>

          {/* Add Button */}
          <Button
            size="lg"
            className="bg-accent-primary rounded-xl shadow-sm"
            onPress={() => {
              hapticMedium();
              setIsAddModalOpen(true);
            }}>
            <Icon as={Plus} size="md" className="text-background mr-2" />
            <ButtonText className="text-background font-semibold">
              {t("notification.customSound.addNew")}
            </ButtonText>
          </Button>

          {/* Custom Sounds List */}
          {customSounds.length === 0 ? (
            <Card className="p-10 bg-background-secondary rounded-xl border border-outline">
              <VStack space="md" className="items-center">
                <Box className="w-16 h-16 rounded-full bg-background-muted items-center justify-center">
                  <Icon as={Volume2} size="xl" className="text-typography-secondary" />
                </Box>
                <Text className="text-typography text-center font-medium">
                  {t("notification.customSound.empty")}
                </Text>
                <Text size="sm" className="text-typography-secondary text-center leading-relaxed">
                  {t("notification.customSound.emptyHint")}
                </Text>
              </VStack>
            </Card>
          ) : (
            <VStack space="md">
              {customSounds.map((sound) => (
                <Card
                  key={sound.id}
                  className="p-4 bg-background-secondary rounded-xl border border-outline shadow-sm">
                  <HStack space="md" className="items-start">
                    <Pressable
                      onPress={() => handleSoundPreview(sound)}
                      className="w-12 h-12 rounded-xl bg-primary/10 items-center justify-center">
                      {isPlayingSound(
                        sound.availableFor[0] || NOTIFICATION_TYPE.PRAYER,
                        sound.id
                      ) ? (
                        <Icon as={Square} size="lg" className="text-primary" />
                      ) : (
                        <Icon as={Play} size="lg" className="text-primary" />
                      )}
                    </Pressable>

                    <VStack space="sm" className="flex-1">
                      <Text className="text-base font-bold text-typography">{sound.name}</Text>
                      <Text size="sm" className="text-typography-secondary">
                        {sound.fileName}
                      </Text>
                      <HStack space="sm" className="flex-wrap mt-0.5">
                        {sound.availableFor.map((type) => (
                          <Badge
                            key={type}
                            size="sm"
                            className="bg-background-info/20 border-primary/20 rounded-md px-2 py-0.5">
                            <BadgeText size="sm" className="text-primary font-medium">
                              {getTypeLabel(type)}
                            </BadgeText>
                          </Badge>
                        ))}
                      </HStack>
                      <Text size="sm" className="text-typography-secondary mt-0.5">
                        {formatFileSize(sound.fileSize)}
                      </Text>
                    </VStack>

                    <Button
                      size="sm"
                      variant="outline"
                      className="border-error/30 rounded-lg"
                      onPress={() => handleDelete(sound.id)}>
                      <Icon as={Trash2} size="sm" className="text-error" />
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
