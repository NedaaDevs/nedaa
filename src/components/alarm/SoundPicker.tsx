import { FC, useState, useEffect, useRef } from "react";
import { Platform } from "react-native";
import { useTranslation } from "react-i18next";

import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Text } from "@/components/ui/text";
import {
  Select,
  SelectTrigger,
  SelectInput,
  SelectIcon,
  SelectPortal,
  SelectBackdrop,
  SelectContent,
  SelectDragIndicatorWrapper,
  SelectDragIndicator,
  SelectItem,
  SelectScrollView,
} from "@/components/ui/select";
import SoundPreviewButton from "@/components/SoundPreviewButton";

import { ChevronDown } from "lucide-react-native";

import { SOUND_ASSETS } from "@/constants/sounds";
import { NOTIFICATION_TYPE } from "@/constants/Notification";
import { useSoundPreview } from "@/hooks/useSoundPreview";
import { useHaptic } from "@/hooks/useHaptic";
import * as ExpoAlarm from "expo-alarm";

const ALARM_SOUNDS = [
  { value: "beep", label: "notification.sound.beep", isSystem: false },
  { value: "tasbih", label: "notification.sound.tasbih", isSystem: false },
  { value: "takbir", label: "notification.sound.takbir", isSystem: false },
  { value: "knock", label: "notification.sound.knock", isSystem: false },
  { value: "makkahAthan1", label: "notification.sound.makkahAthan1", isSystem: false },
  { value: "medinaAthan", label: "notification.sound.medinaAthan", isSystem: false },
  { value: "athan2", label: "notification.sound.athan2", isSystem: false },
  { value: "athan3", label: "notification.sound.athan3", isSystem: false },
  { value: "yasserAldosari", label: "notification.sound.yasserAldosari", isSystem: false },
];

type SoundOption = {
  value: string;
  label: string;
  isSystem: boolean;
};

type Props = {
  value: string;
  onChange: (sound: string) => void;
};

const SoundPicker: FC<Props> = ({ value, onChange }) => {
  const { t } = useTranslation();
  const hapticSelection = useHaptic("selection");
  const hapticLight = useHaptic("light");
  const { playPreview, stopPreview, isPlayingSound } = useSoundPreview();
  const [systemSounds, setSystemSounds] = useState<SoundOption[]>([]);
  const [systemSoundsLoaded, setSystemSoundsLoaded] = useState(false);
  const [isPreviewingSystem, setIsPreviewingSystem] = useState(false);
  const previewTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch system sounds on both platforms
  useEffect(() => {
    ExpoAlarm.getSystemAlarmSounds().then((sounds) => {
      // Deduplicate system sounds (Android RingtoneManager may return duplicates)
      const seen = new Set<string>();
      const options: SoundOption[] = sounds
        .filter((s) => {
          if (seen.has(s.id)) return false;
          seen.add(s.id);
          return true;
        })
        .map((s) => ({
          value: s.id,
          label: s.name,
          isSystem: true,
        }));
      setSystemSounds(options);
      setSystemSoundsLoaded(true);
    });
  }, []);

  // Listen for playback finished event (iOS preview completion)
  useEffect(() => {
    const subscription = ExpoAlarm.addListener("onPlaybackFinished", () => {
      setIsPreviewingSystem(false);
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current);
        previewTimeoutRef.current = null;
      }
    });
    return () => subscription.remove();
  }, []);

  // Cleanup preview timeout on unmount
  useEffect(() => {
    return () => {
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current);
      }
      ExpoAlarm.stopAlarmSound();
    };
  }, []);

  const isSystemSound = (soundValue: string) => {
    // Android system sounds use content:// URI, iOS system sounds start with "iOS-"
    return soundValue.startsWith("content://") || soundValue.startsWith("iOS-");
  };

  const handleValueChange = (newValue: string) => {
    hapticSelection();
    onChange(newValue);
  };

  const handleSoundPreview = async () => {
    hapticLight();

    // Stop any ongoing preview first
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
      previewTimeoutRef.current = null;
    }

    if (isSystemSound(value)) {
      // System sound preview using native player
      if (isPreviewingSystem) {
        await ExpoAlarm.stopAlarmSound();
        setIsPreviewingSystem(false);
      } else {
        await stopPreview(); // Stop any bundled sound preview
        await ExpoAlarm.startAlarmSound(value);
        setIsPreviewingSystem(true);
        // Auto-stop after 5 seconds
        previewTimeoutRef.current = setTimeout(async () => {
          await ExpoAlarm.stopAlarmSound();
          setIsPreviewingSystem(false);
        }, 5000);
      }
    } else {
      // Bundled sound preview
      if (isPreviewingSystem) {
        await ExpoAlarm.stopAlarmSound();
        setIsPreviewingSystem(false);
      }
      if (isPlayingSound(NOTIFICATION_TYPE.PRAYER, value)) {
        await stopPreview();
      } else {
        await playPreview(NOTIFICATION_TYPE.PRAYER, value);
      }
    }
  };

  const getTranslatedLabel = () => {
    // Check if it's a system sound
    if (isSystemSound(value)) {
      // Wait for system sounds to load before showing label
      if (!systemSoundsLoaded) {
        return "...";
      }
      const systemSound = systemSounds.find((s) => s.value === value);
      return systemSound?.label ?? t("notification.sound.unknown");
    }
    // Bundled sound
    const soundAsset = SOUND_ASSETS[value as keyof typeof SOUND_ASSETS];
    if (!soundAsset) return t("notification.sound.unknown");
    return t(soundAsset.label);
  };

  const isCurrentlyPlaying = isSystemSound(value)
    ? isPreviewingSystem
    : isPlayingSound(NOTIFICATION_TYPE.PRAYER, value);

  return (
    <HStack className="justify-between items-center">
      <Text className="text-left text-sm text-typography">{t("alarm.settings.sound")}</Text>
      <HStack space="sm" className="items-center">
        <Select
          key={systemSoundsLoaded ? "loaded" : "loading"}
          initialLabel={value ? getTranslatedLabel() : ""}
          selectedValue={value}
          onValueChange={handleValueChange}
          accessibilityLabel={t("alarm.settings.selectSound")}>
          <SelectTrigger
            variant="outline"
            size="lg"
            className="w-40 h-10 rounded-lg bg-background-primary">
            <SelectInput
              placeholder={t("alarm.settings.selectSound")}
              className="text-left !text-typography font-medium text-sm"
            />
            <SelectIcon className="me-3" as={ChevronDown} />
          </SelectTrigger>

          <SelectPortal>
            <SelectBackdrop />
            <SelectContent className="bg-background-secondary rounded-xl shadow-xl mx-4">
              <SelectDragIndicatorWrapper>
                <SelectDragIndicator />
              </SelectDragIndicatorWrapper>

              <SelectScrollView className="px-2 pt-1 pb-4 max-h-[50vh]">
                {/* App Sounds Section */}
                <VStack className="mb-2">
                  <Text className="text-xs text-typography-secondary px-4 py-2 uppercase">
                    {t("alarm.settings.appSounds")}
                  </Text>
                  {ALARM_SOUNDS.map((option) => {
                    const isSelected = value === option.value;
                    return (
                      <SelectItem
                        key={option.value}
                        label={t(option.label)}
                        value={option.value}
                        className={`px-4 py-4 mb-2 rounded-lg ${
                          isSelected ? "bg-surface-active" : "bg-background-primary"
                        }`}
                      />
                    );
                  })}
                </VStack>

                {/* System Sounds Section */}
                {systemSounds.length > 0 && (
                  <VStack>
                    <Text className="text-xs text-typography-secondary px-4 py-2 uppercase">
                      {t("alarm.settings.systemSounds")}
                    </Text>
                    {systemSounds.map((option) => {
                      const isSelected = value === option.value;
                      return (
                        <SelectItem
                          key={option.value}
                          label={option.label}
                          value={option.value}
                          className={`px-4 py-4 mb-2 rounded-lg ${
                            isSelected ? "bg-surface-active" : "bg-background-primary"
                          }`}
                        />
                      );
                    })}
                  </VStack>
                )}
              </SelectScrollView>
            </SelectContent>
          </SelectPortal>
        </Select>

        <SoundPreviewButton isPlaying={isCurrentlyPlaying} onPress={handleSoundPreview} size="md" />
      </HStack>
    </HStack>
  );
};

export default SoundPicker;
