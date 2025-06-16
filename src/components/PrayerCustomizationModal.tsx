import { FC, useState } from "react";
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
import { Button, ButtonText } from "@/components/ui/button";
import { Divider } from "@/components/ui/divider";
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
import { X, ChevronDown } from "lucide-react-native";

// Types
import { NotificationType, NotificationConfig, NotificationWithTiming } from "@/types/notification";
import { NotificationSoundKey } from "@/types/sound";

// Constants
import { SOUND_ASSETS } from "@/constants/sounds";
// Utils
import { getAvailableSounds } from "@/utils/sound";

// Hooks
import { useSoundPreview } from "@/hooks/useSoundPreview";

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
  const [, setIsTimingOpen] = useState(false);
  const [, setIsSoundOpen] = useState(false);

  // Sound options based on notification type
  const soundOptions = getAvailableSounds(type);

  const timingOptions = [5, 10, 15, 20, 30];

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

  const getTranslatedLabel = () => {
    const soundAsset = SOUND_ASSETS[sound as keyof typeof SOUND_ASSETS];
    if (!soundAsset) return t("notification.sound.unknown");
    return t(soundAsset.label);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalBackdrop />
      <ModalContent className="bg-background-secondary mx-4 my-auto rounded-xl shadow-xl relative">
        <ModalCloseButton className="absolute top-4 right-4 z-10">
          <Icon size="lg" className="text-typography-secondary" as={X} />
        </ModalCloseButton>

        <ModalHeader className="px-6 pt-6 pb-4 pr-12">
          <Text className="text-xl font-bold text-typography text-left">
            {t("notification.customize")} {prayerName}
          </Text>
        </ModalHeader>

        <ModalBody>
          <VStack space="lg">
            {/* Enabled Toggle */}
            <HStack className="justify-between items-center py-2">
              <Text className="text-base font-medium text-typography text-left flex-1">
                {t("common.enable")}
              </Text>
              <Switch value={enabled} onValueChange={setEnabled} />
            </HStack>

            <Divider className="bg-outline" />

            {/* Timing (Iqama & PreAthan) */}
            {hasTiming && timingLabel && (
              <>
                <HStack className="justify-between items-center py-2">
                  <Text className="text-base font-medium text-typography text-left flex-1">
                    {timingLabel}
                  </Text>
                  <Select
                    selectedValue={timing.toString()}
                    onValueChange={(value) => setTiming(parseInt(value))}
                    onOpen={() => setIsTimingOpen(true)}
                    onClose={() => setIsTimingOpen(false)}
                    accessibilityLabel={t("notification.timing.selectPlaceholder")}>
                    <SelectTrigger
                      variant="outline"
                      size="sm"
                      className="w-28 h-10 rounded-lg bg-background-primary transition-all duration-200 active:bg-surface-hover">
                      <SelectInput
                        placeholder={t("notification.timing.selectPlaceholder")}
                        className="text-center !text-typography font-medium"
                      />
                      <SelectIcon
                        className="ml-2 text-typography-secondary"
                        as={ChevronDown}
                        size="md"
                      />
                    </SelectTrigger>
                    <SelectPortal>
                      <SelectBackdrop />
                      <SelectContent className="bg-background-secondary rounded-xl shadow-xl mx-4">
                        <SelectDragIndicatorWrapper className="py-2">
                          <SelectDragIndicator className="w-12 h-1 bg-outline rounded-full" />
                        </SelectDragIndicatorWrapper>
                        <SelectScrollView className="px-4 pt-2 pb-6 max-h-80">
                          {timingOptions.map((min) => {
                            const isSelected = timing === min;
                            return (
                              <SelectItem
                                key={min}
                                label={t("common.minute", { count: min })}
                                value={min.toString()}
                                className={`px-4 py-4 mb-2 rounded-lg transition-all duration-200 ${
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
                </HStack>
                <Divider className="bg-outline" />
              </>
            )}

            {/* Sound Selection */}
            <HStack className="justify-between items-center py-2">
              <Text className="text-base font-medium text-typography text-left flex-1">
                {t("notification.sound")}
              </Text>
              <Select
                selectedValue={sound}
                initialLabel={sound ? getTranslatedLabel() : ""}
                onValueChange={(value) => setSound(value as NotificationSoundKey<typeof type>)}
                onOpen={() => setIsSoundOpen(true)}
                onClose={() => setIsSoundOpen(false)}
                accessibilityLabel={t("notification.sound.selectPlaceholder")}>
                <SelectTrigger
                  variant="outline"
                  size="lg"
                  className="w-48 h-12 rounded-lg bg-background-primary transition-all duration-200 active:bg-surface-hover">
                  <SelectInput
                    placeholder={t("notification.sound.selectPlaceholder", "اختر الصوت")}
                    className="text-left !text-typography font-medium"
                  />
                  <SelectIcon
                    className="ml-2 text-typography-secondary"
                    as={ChevronDown}
                    size="md"
                  />
                </SelectTrigger>
                <SelectPortal>
                  <SelectBackdrop />
                  <SelectContent className="bg-background-secondary rounded-xl shadow-xl mx-4">
                    <SelectDragIndicatorWrapper className="py-2">
                      <SelectDragIndicator className="w-12 h-1 bg-outline rounded-full" />
                    </SelectDragIndicatorWrapper>
                    <SelectScrollView className="px-4 pt-2 pb-6 max-h-80">
                      {soundOptions.map((option) => {
                        const isSelected = sound === option.value;
                        return (
                          <SelectItem
                            key={option.value}
                            label={t(option.label, option.label)}
                            value={option.value}
                            className={`px-4 py-4 mb-2 rounded-lg transition-all duration-200 ${
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
                isPlaying={isPlayingSound(type, sound)}
                onPress={() => handleSoundPreview(type)}
                disabled={sound === "silent"}
                color="text-typography-accent"
              />
            </HStack>

            {/* Vibration */}
            {supportsVibration && (
              <>
                <Divider className="bg-outline" />
                <HStack className="justify-between items-center py-2">
                  <Text className="text-base font-medium text-typography text-left flex-1">
                    {t("notification.vibration")}
                  </Text>
                  <Switch value={vibration} onValueChange={setVibration} />
                </HStack>
              </>
            )}
          </VStack>
        </ModalBody>

        <ModalFooter className="px-6 py-6">
          <VStack space="sm" className="w-full">
            <Button
              onPress={handleSave}
              className="w-full h-12 bg-accent-primary hover:bg-accent-primary rounded-lg shadow-sm">
              <ButtonText className="text-background font-semibold text-base">
                {t("common.saveChanges")}
              </ButtonText>
            </Button>
            <Button
              variant="outline"
              onPress={handleReset}
              className="w-full h-12 rounded-lg bg-background-primary">
              <ButtonText className="text-typography font-semibold text-base">
                {t("notification.resetToDefault")}
              </ButtonText>
            </Button>
          </VStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default PrayerCustomizationModal;
