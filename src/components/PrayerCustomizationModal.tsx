import { FC, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";

// Components
import {
  Modal,
  ModalBackdrop,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
} from "@/components/ui/modal";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Divider } from "@/components/ui/divider";
import { Icon } from "@/components/ui/icon";
import { Select } from "@/components/ui/select";

import SoundPreviewButton from "@/components/SoundPreviewButton";

// Icons
import { X } from "lucide-react-native";

// Types
import { NotificationType, NotificationConfig, NotificationWithTiming } from "@/types/notification";
import { NotificationSoundKey } from "@/types/sound";

// Utils
import { getAvailableSoundsWithCustom } from "@/utils/sound";

// Hooks
import { useSoundPreview } from "@/hooks/useSoundPreview";

// Stores
import { useCustomSoundsStore } from "@/stores/customSounds";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  prayerId: string;
  prayerName: string;
  type: NotificationType;
  defaults: NotificationConfig | NotificationWithTiming;
  currentOverride?: Partial<NotificationConfig | NotificationWithTiming>;
  onSave: (config: Partial<NotificationConfig | NotificationWithTiming>) => void;
  onReset: () => void;
  hasTiming?: boolean;
  timingLabel?: string;
  supportsVibration?: boolean;
};

const PrayerCustomizationModal: FC<Props> = ({
  isOpen,
  onClose,
  prayerName,
  type,
  defaults,
  currentOverride,
  onSave,
  onReset,
  hasTiming = false,
  timingLabel,
  supportsVibration = true,
}) => {
  const { t } = useTranslation();
  const { playPreview, stopPreview, isPlayingSound } = useSoundPreview();
  const { customSounds } = useCustomSoundsStore();

  // Merge defaults with overrides
  const currentConfig = { ...defaults, ...currentOverride };

  // Local state
  const [sound, setSound] = useState<NotificationSoundKey<typeof type>>(
    currentConfig.sound || "silent"
  );
  const [enabled, setEnabled] = useState(currentConfig.enabled || false);
  const [vibration, setVibration] = useState(currentConfig.vibration || false);
  const [timing, setTiming] = useState(
    hasTiming ? (currentConfig as NotificationWithTiming).timing || 10 : 10
  );

  // Sound options based on notification type (including custom sounds)
  const soundOptions = getAvailableSoundsWithCustom(type, customSounds);

  const soundItems = useMemo(
    () =>
      soundOptions.map((option) => ({
        label: option.isCustom ? option.label : t(option.label),
        value: option.value,
      })),
    [soundOptions, t]
  );

  const timingItems = useMemo(
    () =>
      [5, 10, 15, 20, 30].map((min) => ({
        label: t("common.minute", { count: min }),
        value: min.toString(),
      })),
    [t]
  );

  const handleSoundPreview = async (type: NotificationType) => {
    if (isPlayingSound(type, sound)) {
      await stopPreview();
    } else {
      await playPreview(type, sound);
    }
  };

  const handleSave = () => {
    const config: any = {};

    // Only save values that differ from defaults
    if (enabled !== defaults.enabled) config.enabled = enabled;
    if (sound !== defaults.sound) config.sound = sound;
    if (vibration !== defaults.vibration) config.vibration = vibration;
    if (hasTiming && timing !== (defaults as NotificationWithTiming).timing) {
      config.timing = timing;
    }

    // If nothing changed from defaults, reset the override
    if (Object.keys(config).length === 0) {
      onReset();
    } else {
      onSave(config);
    }

    onClose();
  };

  const handleReset = () => {
    onReset();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalBackdrop />
      <ModalContent>
        <ModalCloseButton style={{ position: "absolute", top: 16, end: 16, zIndex: 10 }}>
          <Icon size="lg" color="$typographySecondary" as={X} />
        </ModalCloseButton>

        <ModalHeader>
          <Text size="xl" bold color="$typography">
            {t("notification.customize")} {prayerName}
          </Text>
        </ModalHeader>

        <ModalBody>
          <VStack gap="$4">
            {/* Enabled Toggle */}
            <HStack justifyContent="space-between" alignItems="center" paddingVertical="$2">
              <Text fontWeight="500" color="$typography" flex={1}>
                {t("common.enable")}
              </Text>
              <Switch
                value={enabled}
                onValueChange={setEnabled}
                accessibilityLabel={t("common.enable")}
              />
            </HStack>

            <Divider backgroundColor="$outline" />

            {/* Timing (Iqama & PreAthan) */}
            {hasTiming && timingLabel && (
              <>
                <HStack justifyContent="space-between" alignItems="center" paddingVertical="$2">
                  <Text fontWeight="500" color="$typography" flex={1}>
                    {timingLabel}
                  </Text>
                  <Select
                    selectedValue={timing.toString()}
                    onValueChange={(value) => setTiming(parseInt(value))}
                    items={timingItems}
                    placeholder={t("notification.timing.selectPlaceholder")}
                  />
                </HStack>
                <Divider backgroundColor="$outline" />
              </>
            )}

            {/* Sound Selection */}
            <HStack justifyContent="space-between" alignItems="center" paddingVertical="$2">
              <Text fontWeight="500" color="$typography" flex={1}>
                {t("notification.sound")}
              </Text>
              <Select
                selectedValue={sound}
                onValueChange={(value) => setSound(value as NotificationSoundKey<typeof type>)}
                items={soundItems}
                placeholder={t("notification.sound.selectPlaceholder")}
              />

              <SoundPreviewButton
                isPlaying={isPlayingSound(type, sound)}
                onPress={() => handleSoundPreview(type)}
                disabled={sound === "silent"}
                color="$accentPrimary"
              />
            </HStack>

            {/* Vibration */}
            {supportsVibration && (
              <>
                <Divider backgroundColor="$outline" />
                <HStack justifyContent="space-between" alignItems="center" paddingVertical="$2">
                  <Text fontWeight="500" color="$typography" flex={1}>
                    {t("notification.vibration")}
                  </Text>
                  <Switch
                    value={vibration}
                    onValueChange={setVibration}
                    accessibilityLabel={t("notification.vibration")}
                  />
                </HStack>
              </>
            )}
          </VStack>
        </ModalBody>

        <ModalFooter>
          <VStack gap="$2" width="100%">
            <Button
              onPress={handleSave}
              width="100%"
              height={48}
              backgroundColor="$accentPrimary"
              borderRadius="$4">
              <Button.Text color="$typographyContrast" fontWeight="600">
                {t("common.saveChanges")}
              </Button.Text>
            </Button>
            <Button
              variant="outline"
              onPress={handleReset}
              width="100%"
              height={48}
              borderRadius="$4"
              backgroundColor="$backgroundPrimary">
              <Button.Text color="$typography" fontWeight="600">
                {t("notification.resetToDefault")}
              </Button.Text>
            </Button>
          </VStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default PrayerCustomizationModal;
