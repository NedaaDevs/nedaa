import { FC } from "react";
import { useTranslation } from "react-i18next";

import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { Box } from "@/components/ui/box";

import { Volume2, VolumeX, Minus, Plus } from "lucide-react-native";

import { useHaptic } from "@/hooks/useHaptic";

type Props = {
  value: number;
  onChange: (volume: number) => void;
};

const VOLUME_STEPS = [0, 0.25, 0.5, 0.75, 1.0];

const VolumeSlider: FC<Props> = ({ value, onChange }) => {
  const { t } = useTranslation();
  const hapticLight = useHaptic("light");

  const volumePercentage = Math.round(value * 100);

  const handleDecrease = () => {
    hapticLight();
    const currentIndex = VOLUME_STEPS.findIndex((v) => v >= value);
    const newIndex = Math.max(0, currentIndex - 1);
    onChange(VOLUME_STEPS[newIndex]);
  };

  const handleIncrease = () => {
    hapticLight();
    const currentIndex = VOLUME_STEPS.findIndex((v) => v >= value);
    const newIndex = Math.min(VOLUME_STEPS.length - 1, currentIndex + 1);
    onChange(VOLUME_STEPS[newIndex]);
  };

  const handleStepPress = (step: number) => {
    hapticLight();
    onChange(step);
  };

  return (
    <VStack space="sm">
      <HStack className="justify-between items-center">
        <Text className="text-sm text-typography">{t("alarm.settings.volume")}</Text>
        <Text className="text-sm text-typography-secondary">{volumePercentage}%</Text>
      </HStack>
      <HStack space="sm" className="items-center">
        <Icon
          as={VolumeX}
          size="sm"
          className={value === 0 ? "text-warning" : "text-typography-secondary"}
        />
        <HStack className="flex-1 justify-between items-center px-2">
          <Pressable
            onPress={handleDecrease}
            className="w-8 h-8 rounded-full bg-background-muted items-center justify-center">
            <Icon as={Minus} size="sm" className="text-typography" />
          </Pressable>

          <HStack space="xs" className="flex-1 justify-center">
            {VOLUME_STEPS.map((step) => (
              <Pressable key={step} onPress={() => handleStepPress(step)} className="px-1">
                <Box
                  className={`w-3 h-3 rounded-full ${
                    value >= step ? "bg-accent-primary" : "bg-background-muted"
                  }`}
                />
              </Pressable>
            ))}
          </HStack>

          <Pressable
            onPress={handleIncrease}
            className="w-8 h-8 rounded-full bg-background-muted items-center justify-center">
            <Icon as={Plus} size="sm" className="text-typography" />
          </Pressable>
        </HStack>
        <Icon as={Volume2} size="sm" className="text-typography-secondary" />
      </HStack>
    </VStack>
  );
};

export default VolumeSlider;
