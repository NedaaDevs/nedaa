import { FC } from "react";
import { useTranslation } from "react-i18next";

import { HStack } from "@/components/ui/hstack";
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

const ALARM_SOUNDS = [
  { value: "beep", label: "notification.sound.beep" },
  { value: "tasbih", label: "notification.sound.tasbih" },
  { value: "takbir", label: "notification.sound.takbir" },
  { value: "knock", label: "notification.sound.knock" },
  { value: "makkahAthan1", label: "notification.sound.makkahAthan1" },
  { value: "medinaAthan", label: "notification.sound.medinaAthan" },
  { value: "athan2", label: "notification.sound.athan2" },
  { value: "athan3", label: "notification.sound.athan3" },
  { value: "yasserAldosari", label: "notification.sound.yasserAldosari" },
];

type Props = {
  value: string;
  onChange: (sound: string) => void;
};

const SoundPicker: FC<Props> = ({ value, onChange }) => {
  const { t } = useTranslation();
  const hapticSelection = useHaptic("selection");
  const hapticLight = useHaptic("light");
  const { playPreview, stopPreview, isPlayingSound } = useSoundPreview();

  const handleValueChange = (newValue: string) => {
    hapticSelection();
    onChange(newValue);
  };

  const handleSoundPreview = async () => {
    hapticLight();
    if (isPlayingSound(NOTIFICATION_TYPE.PRAYER, value)) {
      await stopPreview();
    } else {
      await playPreview(NOTIFICATION_TYPE.PRAYER, value);
    }
  };

  const getTranslatedLabel = () => {
    const soundAsset = SOUND_ASSETS[value as keyof typeof SOUND_ASSETS];
    if (!soundAsset) return t("notification.sound.unknown");
    return t(soundAsset.label);
  };

  return (
    <HStack className="justify-between items-center">
      <Text className="text-sm text-typography">{t("alarm.settings.sound")}</Text>
      <HStack space="sm" className="items-center">
        <Select
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
            <SelectIcon className="mr-3" as={ChevronDown} />
          </SelectTrigger>

          <SelectPortal>
            <SelectBackdrop />
            <SelectContent className="bg-background-secondary rounded-xl shadow-xl mx-4">
              <SelectDragIndicatorWrapper>
                <SelectDragIndicator />
              </SelectDragIndicatorWrapper>

              <SelectScrollView className="px-2 pt-1 pb-4 max-h-[50vh]">
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
              </SelectScrollView>
            </SelectContent>
          </SelectPortal>
        </Select>

        <SoundPreviewButton
          isPlaying={isPlayingSound(NOTIFICATION_TYPE.PRAYER, value)}
          onPress={handleSoundPreview}
          size="md"
        />
      </HStack>
    </HStack>
  );
};

export default SoundPicker;
