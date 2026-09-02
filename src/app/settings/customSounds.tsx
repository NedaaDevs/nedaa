import { useTranslation } from "react-i18next";
import { ScrollView, Alert, Platform } from "react-native";
import { useState, useEffect, useRef } from "react";

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
  getAlarmUsagesForUri,
  releaseCustomSoundFromAlarms,
  CUSTOM_SOUND_REPLACEMENT,
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

  const deletingIdsRef = useRef(new Set<string>());
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

  // Removes the file only once every selection pointing at it has been moved off.
  // Alarms are released first because that is the step that can fail: nothing else
  // changes until the native database has accepted the new sound.
  const removeSound = async (sound: CustomSound, replaceNotifications: boolean): Promise<void> => {
    const released = await releaseCustomSoundFromAlarms(sound.contentUri);
    if (!released) {
      Alert.alert(
        t("notification.customSound.deleteFailedTitle"),
        t("notification.customSound.deleteFailedMessage")
      );
      return;
    }

    if (replaceNotifications) {
      await updateSettings(
        replaceCustomSoundInSettings(sound.id, CUSTOM_SOUND_REPLACEMENT, settings)
      );
    }

    // Keeping the entry when the file survives leaves the list matching what is on disk.
    // The settings have already moved off it, so this reports the file, not the alarm.
    const deleted = await deleteCustomSoundFromMediaStore(sound.contentUri);
    if (!deleted) {
      Alert.alert(
        t("notification.customSound.deleteFailedTitle"),
        t("notification.customSound.deleteFileFailedMessage")
      );
      return;
    }
    await deleteCustomSound(sound.id);
  };

  const handleDelete = async (id: string) => {
    const sound = customSounds.find((s) => s.id === id);
    if (!sound) return;

    // Reading alarm usage is async, so two quick taps could otherwise open two dialogs
    // and run the delete twice.
    if (deletingIdsRef.current.has(id)) return;
    deletingIdsRef.current.add(id);
    try {
      await confirmDelete(sound);
    } finally {
      deletingIdsRef.current.delete(id);
    }
  };

  // Resolves only once the dialog is answered and the confirmed work has finished, so
  // the caller's in-flight guard covers the whole delete rather than just the prompt.
  const confirmThen = (
    title: string,
    message: string,
    confirmLabel: string,
    onConfirm: () => Promise<void>
  ): Promise<void> =>
    new Promise((resolve) => {
      Alert.alert(
        title,
        message,
        [
          { text: t("common.cancel"), style: "cancel", onPress: () => resolve() },
          {
            text: confirmLabel,
            style: "destructive",
            onPress: async () => {
              await onConfirm();
              resolve();
            },
          },
        ],
        { onDismiss: () => resolve() }
      );
    });

  const confirmDelete = async (sound: CustomSound) => {
    const id = sound.id;

    // Notification settings reference the custom sound id; alarms reference the URI.
    const usedSounds = getUsedCustomSounds();
    const usages = getCustomSoundUsages(id, settings);
    const alarmUsages = await getAlarmUsagesForUri(sound.contentUri);
    // Null means the alarm database could not be read. Deleting on an unknown answer
    // could pull the file out from under an alarm that still points at it.
    if (alarmUsages === null) {
      Alert.alert(
        t("notification.customSound.deleteFailedTitle"),
        t("notification.customSound.deleteUnknownMessage")
      );
      return;
    }
    const isInUse = usedSounds.has(id) || alarmUsages.length > 0;

    if (isInUse && usages.length + alarmUsages.length > 0) {
      // Format usages
      const usageLabels = [
        ...usages.map((usage) =>
          usage.prayerId
            ? t(`notification.customSound.usage.${usage.type}`, { prayer: usage.prayerId })
            : t(`notification.customSound.usage.default.${usage.type}`)
        ),
        ...alarmUsages.map((alarmType) => t(`alarm.types.${alarmType}`)),
      ];

      // Show alert with auto-replacement option
      await confirmThen(
        t("notification.customSound.deleteInUseTitle"),
        t("notification.customSound.deleteInUseMessage", {
          name: sound.name,
          usages: usageLabels.join(", "),
          replacement: t("notification.sound.beep"),
        }),
        t("notification.customSound.replaceAndDelete"),
        async () => {
          hapticMedium();
          await removeSound(sound, true);
        }
      );
    } else {
      // Show regular delete confirmation
      await confirmThen(
        t("notification.customSound.deleteTitle"),
        t("notification.customSound.deleteMessage", { name: sound.name }),
        t("common.delete"),
        async () => {
          hapticMedium();
          await removeSound(sound, false);
        }
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
          <Card padding="$5" borderWidth={1} borderColor="$outline">
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
            <Card padding="$7" borderWidth={1} borderColor="$outline">
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
                <Card key={sound.id} borderWidth={1} borderColor="$outline">
                  <HStack gap="$3" alignItems="flex-start">
                    <Pressable
                      onPress={() => handleSoundPreview(sound)}
                      accessibilityRole="button"
                      accessibilityLabel={t("a11y.customSound.previewSound", { name: sound.name })}
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
                      accessibilityLabel={t("common.delete")}
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
