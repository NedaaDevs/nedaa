import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Platform, ActivityIndicator, ScrollView } from "react-native";
import { useAudioPlayer } from "expo-audio";

// Components
import {
  Modal,
  ModalBackdrop,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
} from "@/components/ui/modal";
import { Box } from "@/components/ui/box";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import SoundPreviewButton from "@/components/SoundPreviewButton";

// Icons
import { X, Music, Smartphone, Check } from "lucide-react-native";

// Types
import type { AlarmSoundKey } from "@/types/alarm";
import type { SystemAlarmSound } from "@/types/customSound";

// Constants
import { ALARM_SOUND_KEYS, getAlarmSound } from "@/constants/AlarmSounds";
import { SOUND_ASSETS } from "@/constants/sounds";

// Utils
import { getSystemAlarmSounds } from "@/utils/systemAlarmSounds";

// Hooks
import { useSoundPreview } from "@/hooks/useSoundPreview";

// Enums
import { PlatformType } from "@/enums/app";

// Constants
import { NOTIFICATION_TYPE } from "@/constants/Notification";

type AlarmSoundPickerProps = {
  isOpen: boolean;
  onClose: () => void;
  selectedSound: AlarmSoundKey;
  onSelectSound: (sound: AlarmSoundKey) => void;
};

type SoundCategory = "app" | "system";

interface SoundItem {
  id: string;
  title: string;
  category: SoundCategory;
  uri?: string;
}

const AlarmSoundPicker = ({
  isOpen,
  onClose,
  selectedSound,
  onSelectSound,
}: AlarmSoundPickerProps) => {
  const { t } = useTranslation();
  const { playPreview, stopPreview, isPlayingSound } = useSoundPreview();

  // Separate audio player for system sounds
  const systemSoundPlayer = useAudioPlayer();
  const [playingSystemSoundId, setPlayingSystemSoundId] = useState<string | null>(null);

  const [systemSounds, setSystemSounds] = useState<SystemAlarmSound[]>([]);
  const [isLoadingSystemSounds, setIsLoadingSystemSounds] = useState(false);
  const [activeCategory, setActiveCategory] = useState<SoundCategory>("app");

  // Load system alarm sounds when modal opens (Android only)
  useEffect(() => {
    if (isOpen && Platform.OS === PlatformType.ANDROID) {
      loadSystemSounds();
    }
  }, [isOpen]);

  // Stop system sound when modal closes
  useEffect(() => {
    if (!isOpen && playingSystemSoundId) {
      systemSoundPlayer.pause();
      setPlayingSystemSoundId(null);
    }
  }, [isOpen, playingSystemSoundId, systemSoundPlayer]);

  const loadSystemSounds = async () => {
    setIsLoadingSystemSounds(true);
    try {
      const sounds = await getSystemAlarmSounds();
      setSystemSounds(sounds);
    } catch (error) {
      console.error("[AlarmSoundPicker] Error loading system sounds:", error);
    } finally {
      setIsLoadingSystemSounds(false);
    }
  };

  // Build app sounds list
  const appSounds: SoundItem[] = ALARM_SOUND_KEYS.map((key) => {
    const sound = getAlarmSound(key);

    return {
      id: key,
      title: sound?.label ? t(sound.label) : key,
      category: "app" as SoundCategory,
    };
  });

  // Build system sounds list
  const systemSoundItems: SoundItem[] = systemSounds.map((sound) => ({
    id: sound.id,
    title: sound.title,
    category: "system" as SoundCategory,
    uri: sound.uri,
  }));

  const handleSoundSelect = (soundId: string) => {
    onSelectSound(soundId as AlarmSoundKey);
    onClose();
  };

  const handlePreview = useCallback(
    async (soundItem: SoundItem) => {
      const soundId = soundItem.id;

      // For app sounds, use the existing preview system
      if (soundItem.category === "app") {
        // Stop any system sound that might be playing
        if (playingSystemSoundId) {
          await systemSoundPlayer.pause();
          setPlayingSystemSoundId(null);
        }

        if (isPlayingSound(NOTIFICATION_TYPE.PRAYER, soundId)) {
          await stopPreview();
        } else {
          await playPreview(NOTIFICATION_TYPE.PRAYER, soundId);
        }
      } else if (soundItem.category === "system" && soundItem.uri) {
        // Stop any app sound that might be playing
        await stopPreview();

        // For system sounds, use the dedicated system sound player
        if (playingSystemSoundId === soundId) {
          await systemSoundPlayer.pause();
          setPlayingSystemSoundId(null);
        } else {
          try {
            await systemSoundPlayer.replace(soundItem.uri);
            await systemSoundPlayer.play();
            setPlayingSystemSoundId(soundId);
          } catch (error) {
            console.error("[AlarmSoundPicker] Error playing system sound:", error);
            setPlayingSystemSoundId(null);
          }
        }
      }
    },
    [isPlayingSound, playPreview, stopPreview, playingSystemSoundId, systemSoundPlayer]
  );

  const isSelected = (soundId: string) => selectedSound === soundId;

  const renderSoundItem = (item: SoundItem) => {
    const selected = isSelected(item.id);
    const playing =
      item.category === "system"
        ? playingSystemSoundId === item.id
        : isPlayingSound(NOTIFICATION_TYPE.PRAYER, item.id);

    return (
      <Pressable
        key={item.id}
        onPress={() => handleSoundSelect(item.id)}
        className={`p-4 rounded-xl mb-2 ${
          selected ? "bg-primary-500/20 border border-primary-500" : "bg-background-tertiary"
        }`}>
        <HStack className="items-center justify-between">
          <HStack className="items-center gap-3 flex-1">
            {selected && <Icon as={Check} size="sm" className="text-primary-500" />}
            <Text
              className={`text-base ${selected ? "text-primary-500 font-semibold" : "text-typography"}`}
              numberOfLines={1}>
              {item.title}
            </Text>
          </HStack>

          <SoundPreviewButton
            isPlaying={playing}
            onPress={() => handlePreview(item)}
            color={selected ? "text-primary-500" : "text-typography-secondary"}
          />
        </HStack>
      </Pressable>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalBackdrop />
      <ModalContent className="bg-background-secondary mx-4 rounded-2xl shadow-xl relative max-h-[80%]">
        <ModalCloseButton className="absolute top-4 right-4 z-10">
          <Icon as={X} className="text-typography-secondary" size="lg" />
        </ModalCloseButton>

        <ModalHeader className="px-6 pt-6 pb-4 pr-12">
          <Text className="text-xl font-bold text-typography">
            {t("alarm.sound.title", "Alarm Sound")}
          </Text>
        </ModalHeader>

        {/* Category Tabs (Android only - iOS doesn't have system sounds access) */}
        {Platform.OS === PlatformType.ANDROID && (
          <HStack className="px-6 pb-4 gap-2">
            <Pressable
              onPress={() => setActiveCategory("app")}
              className={`flex-1 py-3 rounded-xl flex-row items-center justify-center gap-2 ${
                activeCategory === "app" ? "bg-primary-500" : "bg-background-tertiary"
              }`}>
              <Icon
                as={Music}
                size="sm"
                className={activeCategory === "app" ? "text-white" : "text-typography-secondary"}
              />
              <Text
                className={`font-medium ${
                  activeCategory === "app" ? "text-white" : "text-typography"
                }`}>
                {t("alarm.sound.appSounds", "App Sounds")}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveCategory("system")}
              className={`flex-1 py-3 rounded-xl flex-row items-center justify-center gap-2 ${
                activeCategory === "system" ? "bg-primary-500" : "bg-background-tertiary"
              }`}>
              <Icon
                as={Smartphone}
                size="sm"
                className={activeCategory === "system" ? "text-white" : "text-typography-secondary"}
              />
              <Text
                className={`font-medium ${
                  activeCategory === "system" ? "text-white" : "text-typography"
                }`}>
                {t("alarm.sound.systemSounds", "System")}
              </Text>
            </Pressable>
          </HStack>
        )}

        <ModalBody className="px-6 pb-6">
          <ScrollView className="max-h-96" showsVerticalScrollIndicator={false}>
            {/* App Sounds */}
            {(Platform.OS !== PlatformType.ANDROID || activeCategory === "app") && (
              <VStack>
                {Platform.OS !== PlatformType.ANDROID && (
                  <Text className="text-sm font-semibold text-typography-secondary uppercase mb-3">
                    {t("alarm.sound.appSounds", "App Sounds")}
                  </Text>
                )}
                {appSounds.map(renderSoundItem)}
              </VStack>
            )}

            {/* System Sounds (Android only) */}
            {Platform.OS === PlatformType.ANDROID && activeCategory === "system" && (
              <VStack>
                {isLoadingSystemSounds ? (
                  <Box className="py-8 items-center">
                    <ActivityIndicator size="large" color="#10b981" />
                    <Text className="text-typography-secondary mt-3">
                      {t("alarm.sound.loading", "Loading sounds...")}
                    </Text>
                  </Box>
                ) : systemSoundItems.length === 0 ? (
                  <Box className="py-8 items-center">
                    <Icon as={Smartphone} size="xl" className="text-typography-tertiary mb-3" />
                    <Text className="text-typography-secondary text-center">
                      {t("alarm.sound.noSystemSounds", "No system alarm sounds found")}
                    </Text>
                  </Box>
                ) : (
                  systemSoundItems.map(renderSoundItem)
                )}
              </VStack>
            )}
          </ScrollView>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default AlarmSoundPicker;
