import { FC, useState, useEffect } from "react";
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

// Icons
import { X, ChevronDown } from "lucide-react-native";

// Types
import { NotificationType, NotificationConfig, NotificationWithTiming } from "@/types/notification";

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

  // Merge defaults with overrides
  const currentConfig = { ...defaults, ...currentOverride };

  // Local state
  const [enabled, setEnabled] = useState(currentConfig.enabled);
  const [sound, setSound] = useState(currentConfig.sound);
  const [vibration, setVibration] = useState(currentConfig.vibration);
  const [timing, setTiming] = useState(
    hasTiming ? (currentConfig as NotificationWithTiming).timing : 10
  );

  // Sound options based on notification type
  const getSoundOptions = () => {
    if (type === "prayer") {
      return [
        { label: "notification.sound.makkahAthan", value: "makkah" },
        { label: "notification.sound.madinahAthan", value: "madinah" },
        { label: "notification.sound.default", value: "default" },
        { label: "notification.sound.silent", value: "silent" },
      ];
    } else {
      return [
        { label: "notification.sound.gentle", value: "gentle" },
        { label: "notification.sound.bell", value: "bell" },
        { label: "notification.sound.shortBeep", value: "short" },
        { label: "notification.sound.silent", value: "silent" },
      ];
    }
  };

  const timingOptions = [5, 10, 15, 20, 30];

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
        <ModalHeader>
          <VStack className="flex-1">
            <Text className="text-lg font-semibold">
              {t("notification.customize")} {prayerName}
            </Text>
            <Text className="text-sm text-gray-500">
              {type === "prayer"
                ? t("notification.prayerNotification")
                : type === "iqama"
                  ? t("notification.iqamaReminder")
                  : t("notification.preAthanAlert")}
            </Text>
          </VStack>
          <ModalCloseButton>
            <X size={20} />
          </ModalCloseButton>
        </ModalHeader>

        <ModalBody>
          <VStack space="lg">
            {/* Enabled Toggle */}
            <HStack className="justify-between items-center">
              <Text className="text-base">{t("common.enabled")}</Text>
              <Switch
                value={enabled}
                onValueChange={setEnabled}
                className="data-[state=checked]:bg-primary-500"
              />
            </HStack>

            <Divider />

            {/* Timing (if applicable) */}
            {hasTiming && timingLabel && (
              <>
                <HStack className="justify-between items-center">
                  <Text className="text-base">{timingLabel}</Text>
                  <HStack space="xs" className="items-center">
                    <Select
                      selectedValue={timing.toString()}
                      onValueChange={(value) => setTiming(parseInt(value))}>
                      <SelectTrigger variant="outline" size="sm" className="w-24">
                        <SelectInput />
                        <SelectIcon>
                          <ChevronDown size={16} />
                        </SelectIcon>
                      </SelectTrigger>
                      <SelectPortal>
                        <SelectBackdrop />
                        <SelectContent>
                          <SelectDragIndicatorWrapper>
                            <SelectDragIndicator />
                          </SelectDragIndicatorWrapper>
                          <SelectScrollView>
                            {timingOptions.map((min) => (
                              <SelectItem
                                key={min}
                                label={t("common.minute", {
                                  count: min,
                                })}
                                value={min.toString()}
                              />
                            ))}
                          </SelectScrollView>
                        </SelectContent>
                      </SelectPortal>
                    </Select>
                  </HStack>
                </HStack>
                <Divider />
              </>
            )}

            {/* Sound Selection */}
            <HStack className="justify-between items-center">
              <Text className="text-base">{t("notification.sound")}</Text>
              <Select selectedValue={sound} onValueChange={setSound}>
                <SelectTrigger variant="outline" size="sm" className="w-40">
                  <SelectInput />
                  <SelectIcon>
                    <ChevronDown size={16} />
                  </SelectIcon>
                </SelectTrigger>
                <SelectPortal>
                  <SelectBackdrop />
                  <SelectContent>
                    <SelectDragIndicatorWrapper>
                      <SelectDragIndicator />
                    </SelectDragIndicatorWrapper>
                    <SelectScrollView>
                      {getSoundOptions().map((option) => (
                        <SelectItem
                          key={option.value}
                          label={t(option.label)}
                          value={option.value}
                        />
                      ))}
                    </SelectScrollView>
                  </SelectContent>
                </SelectPortal>
              </Select>
            </HStack>

            {/* Vibration */}
            {supportsVibration && (
              <HStack className="justify-between items-center">
                <Text className="text-base">{t("notification.vibration")}</Text>
                <Switch
                  value={vibration}
                  onValueChange={setVibration}
                  className="data-[state=checked]:bg-primary-500"
                />
              </HStack>
            )}
          </VStack>
        </ModalBody>

        <ModalFooter>
          <VStack space="sm" className="w-full">
            <Button onPress={handleSave} className="w-full">
              <ButtonText>{t("common.saveChanges")}</ButtonText>
            </Button>
            <Button variant="outline" onPress={handleReset} className="w-full">
              <ButtonText>{t("notification.resetToDefault")}</ButtonText>
            </Button>
          </VStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default PrayerCustomizationModal;
