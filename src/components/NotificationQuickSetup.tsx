import { FC, useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";

// Constants
import { NOTIFICATION_TYPE } from "@/constants/Notification";

// Hooks
import { useSoundPreview } from "@/hooks/useSoundPreview";
import { useHaptic } from "@/hooks/useHaptic";

// Utils
import { getAvailableSoundsWithCustom } from "@/utils/sound";

// Types
import type { NotificationType } from "@/types/notification";
import type { PrayerSoundKey } from "@/constants/sounds";

// Stores
import { useCustomSoundsStore } from "@/stores/customSounds";

// Components
import { Box } from "@/components/ui/box";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Select } from "@/components/ui/select";

import SoundPreviewButton from "@/components/SoundPreviewButton";

// Icons
import { Zap } from "lucide-react-native";

type Props = {
  currentSound: PrayerSoundKey;
  vibrationEnabled: boolean;
  onApply: (sound: PrayerSoundKey, vibration: boolean) => void;
  supportsVibration?: boolean;
};

const NotificationQuickSetup: FC<Props> = ({
  currentSound,
  vibrationEnabled,
  onApply,
  supportsVibration = true,
}) => {
  const { t } = useTranslation();
  const hapticSelection = useHaptic("selection");
  const hapticSuccess = useHaptic("success");
  const hapticLight = useHaptic("light");

  const { playPreview, stopPreview, isPlayingSound } = useSoundPreview();
  const { customSounds } = useCustomSoundsStore();

  // Local state for quick setup
  const [localSound, setLocalSound] = useState<PrayerSoundKey>(currentSound);
  const [localVibration, setLocalVibration] = useState(vibrationEnabled);

  // Sync local state with props when they change
  useEffect(() => {
    setLocalSound(currentSound);
  }, [currentSound]);

  useEffect(() => {
    setLocalVibration(vibrationEnabled);
  }, [vibrationEnabled]);

  const soundOptions = getAvailableSoundsWithCustom(NOTIFICATION_TYPE.PRAYER, customSounds);

  const soundItems = useMemo(
    () =>
      soundOptions.map((option) => ({
        label: option.isCustom ? option.label : t(option.label),
        value: option.value,
      })),
    [soundOptions, t]
  );

  const handleApply = () => {
    hapticSuccess();
    stopPreview();
    onApply(localSound, localVibration);
  };

  const handleSoundPreview = async (type: NotificationType) => {
    hapticLight();
    if (isPlayingSound(type, localSound)) {
      await stopPreview();
    } else {
      await playPreview(type, localSound);
    }
  };

  const handleValueChange = (value: string) => {
    hapticSelection();
    setLocalSound(value as PrayerSoundKey);
  };

  return (
    <Box marginHorizontal="$4" padding="$4" borderRadius="$4">
      <VStack gap="$3">
        <HStack gap="$2" alignItems="center">
          <Icon color="$accentPrimary" size="lg" as={Zap} />
          <Text fontWeight="600" color="$accentPrimary">
            {t("notification.quickSetup")}
          </Text>
        </HStack>

        <Text textAlign="left" size="sm" color="$typography">
          {t("notification.quickSetupDescription")}
        </Text>

        <VStack gap="$2">
          <HStack justifyContent="space-between" alignItems="center">
            <Text size="sm" color="$typography">
              {t("notification.sound")}
            </Text>
            <Select
              selectedValue={localSound}
              onValueChange={handleValueChange}
              items={soundItems}
              placeholder={t("notification.sound.selectPlaceholder")}
            />

            <SoundPreviewButton
              isPlaying={isPlayingSound(NOTIFICATION_TYPE.PRAYER, localSound)}
              onPress={() => handleSoundPreview(NOTIFICATION_TYPE.PRAYER)}
              disabled={localSound === "silent"}
              color="$accentPrimary"
            />
          </HStack>

          {supportsVibration && (
            <HStack justifyContent="space-between" alignItems="center">
              <Text size="sm" color="$typography">
                {t("notification.vibration")}
              </Text>
              <Switch
                value={localVibration}
                onValueChange={(value) => {
                  hapticSelection();
                  setLocalVibration(value);
                }}
                size="sm"
                accessibilityLabel={t("notification.vibration")}
              />
            </HStack>
          )}
        </VStack>

        <Button onPress={handleApply} size="lg" backgroundColor="$accentPrimary">
          <Button.Text color="$typographyContrast">{t("notification.applyToAll")}</Button.Text>
        </Button>
      </VStack>
    </Box>
  );
};

export default NotificationQuickSetup;
