import { FC, useState } from "react";
import { useTranslation } from "react-i18next";

// Constants
import { NOTIFICATION_TYPE } from "@/constants/Notification";
import { SOUND_ASSETS } from "@/constants/sounds";

// Hooks
import { useSoundPreview } from "@/hooks/useSoundPreview";

// Utils
import { getAvailableSounds } from "@/utils/sound";

// Types
import type { NotificationType } from "@/types/notification";
import type { PrayerSoundKey } from "@/constants/sounds";

// Components
import { Box } from "@/components/ui/box";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Switch } from "@/components/ui/switch";
import { Button, ButtonText } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
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

// Icons
import { Zap, ChevronDown } from "lucide-react-native";

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

  const { playPreview, stopPreview, isPlayingSound } = useSoundPreview();

  // Local state for quick setup
  const [localSound, setLocalSound] = useState<PrayerSoundKey>(currentSound);
  const [localVibration, setLocalVibration] = useState(vibrationEnabled);
  const [isOpen, setIsOpen] = useState(false);

  const soundOptions = getAvailableSounds(NOTIFICATION_TYPE.PRAYER);

  const handleApply = () => {
    stopPreview(); // Stop any playing preview
    onApply(localSound, localVibration);
  };

  const handleSoundPreview = async (type: NotificationType) => {
    if (isPlayingSound(type, localSound)) {
      await stopPreview();
    } else {
      await playPreview(type, localSound);
    }
  };

  const handleValueChange = (value: string) => {
    // Type assertion is safe here because Select only shows valid prayer sounds
    setLocalSound(value as PrayerSoundKey);
  };

  const getTranslatedLabel = () => {
    const soundAsset = SOUND_ASSETS[localSound as keyof typeof SOUND_ASSETS];
    if (!soundAsset) return t("notification.sound.unknown");
    return t(soundAsset.label);
  };

  return (
    <Box className="mx-4 p-4 rounded-lg">
      <VStack space="md">
        <HStack space="sm" className="items-center">
          <Icon className="text-accent-primary" size="lg" as={Zap} />
          <Text className="text-base font-semibold text-typography-accent">
            {t("notification.quickSetup")}
          </Text>
        </HStack>

        <Text className="text-left text-sm text-typography">
          {t("notification.quickSetupDescription")}
        </Text>

        <VStack space="sm">
          <HStack className="justify-between items-center">
            <Text className="text-sm text-typography">{t("notification.sound")}</Text>
            <Select
              initialLabel={localSound ? getTranslatedLabel() : ""}
              selectedValue={localSound}
              onValueChange={handleValueChange}
              onOpen={() => setIsOpen(true)}
              onClose={() => setIsOpen(false)}
              accessibilityLabel={t("notification.sound.selectPlaceholder")}>
              <SelectTrigger
                variant="outline"
                size="lg"
                className="w-48 h-12 rounded-lg bg-background-primary transition-all duration-200 active:bg-surface-hover">
                <SelectInput
                  placeholder={t("notification.sound.selectPlaceholder")}
                  className="text-left !text-typography font-medium"
                />
                <SelectIcon className="mr-3" as={ChevronDown} />
              </SelectTrigger>

              <SelectPortal>
                <SelectBackdrop />
                <SelectContent>
                  <SelectDragIndicatorWrapper>
                    <SelectDragIndicator />
                  </SelectDragIndicatorWrapper>

                  <SelectScrollView className="px-2 pt-1 pb-4 max-h-[50vh]">
                    {soundOptions.map((option) => {
                      const isSelected = localSound === option.value;

                      return (
                        <SelectItem
                          key={option.value}
                          label={t(option.label)}
                          value={option.value}
                          className={`px-4 py-4 mb-2 rounded-lg transition-all duration-200 ease-in-out ${
                            isSelected
                              ? "bg-surface-active"
                              : "bg-background-primary hover:bg-surface-hover"
                          }`}
                        />
                      );
                    })}
                  </SelectScrollView>
                </SelectContent>
              </SelectPortal>
            </Select>

            <SoundPreviewButton
              isPlaying={isPlayingSound(NOTIFICATION_TYPE.PRAYER, localSound)}
              onPress={() => handleSoundPreview(NOTIFICATION_TYPE.PRAYER)}
              disabled={localSound === "silent"}
              color="text-typography-accent"
            />
          </HStack>

          {supportsVibration && (
            <HStack className="justify-between items-center">
              <Text className="text-sm text-typography">{t("notification.vibration")}</Text>
              <Switch value={localVibration} onValueChange={setLocalVibration} size="sm" />
            </HStack>
          )}
        </VStack>

        <Button
          onPress={handleApply}
          size="sm"
          className="bg-accent-primary hover:bg-accent-primary">
          <ButtonText className="text-background">{t("notification.applyToAll")}</ButtonText>
        </Button>
      </VStack>
    </Box>
  );
};

export default NotificationQuickSetup;
