import { FC, useState, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Select } from "@/components/ui/select";
import SoundPreviewButton from "@/components/SoundPreviewButton";

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
  const [, setSystemSoundsLoaded] = useState(false);
  const [isPreviewingSystem, setIsPreviewingSystem] = useState(false);
  const previewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    ExpoAlarm.getSystemAlarmSounds().then((sounds) => {
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

  useEffect(() => {
    return () => {
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current);
      }
      ExpoAlarm.stopAlarmSound();
    };
  }, []);

  const isSystemSound = (soundValue: string) => {
    return soundValue.startsWith("content://") || soundValue.startsWith("iOS-");
  };

  const handleValueChange = (newValue: string) => {
    hapticSelection();
    onChange(newValue);
  };

  const handleSoundPreview = async () => {
    hapticLight();

    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
      previewTimeoutRef.current = null;
    }

    if (isSystemSound(value)) {
      if (isPreviewingSystem) {
        await ExpoAlarm.stopAlarmSound();
        setIsPreviewingSystem(false);
      } else {
        await stopPreview();
        await ExpoAlarm.startAlarmSound(value);
        setIsPreviewingSystem(true);
        previewTimeoutRef.current = setTimeout(async () => {
          await ExpoAlarm.stopAlarmSound();
          setIsPreviewingSystem(false);
        }, 5000);
      }
    } else {
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

  const translatedAppSounds = useMemo(
    () => ALARM_SOUNDS.map((s) => ({ label: t(s.label), value: s.value })),
    [t]
  );

  const translatedSystemSounds = useMemo(
    () => systemSounds.map((s) => ({ label: s.label, value: s.value })),
    [systemSounds]
  );

  const allSoundItems = useMemo(() => {
    const items = [...translatedAppSounds];
    if (translatedSystemSounds.length > 0) {
      items.push(...translatedSystemSounds);
    }
    return items;
  }, [translatedAppSounds, translatedSystemSounds]);

  const isCurrentlyPlaying = isSystemSound(value)
    ? isPreviewingSystem
    : isPlayingSound(NOTIFICATION_TYPE.PRAYER, value);

  return (
    <HStack justifyContent="space-between" alignItems="center">
      <Text textAlign="left" size="sm" color="$typography" flex={1}>
        {t("alarm.settings.sound")}
      </Text>
      <Select
        selectedValue={value}
        onValueChange={handleValueChange}
        items={allSoundItems}
        placeholder={t("alarm.settings.selectSound")}
      />
      <SoundPreviewButton isPlaying={isCurrentlyPlaying} onPress={handleSoundPreview} size="md" />
    </HStack>
  );
};

export default SoundPicker;
