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
import { useRTL } from "@/contexts/RTLContext";

type Props = {
  value: number;
  onChange: (volume: number) => void;
};

const VOLUME_STEPS = [0, 0.25, 0.5, 0.75, 1.0];

const VolumeSlider: FC<Props> = ({ value, onChange }) => {
  const { t } = useTranslation();
  const hapticLight = useHaptic("light");
  const { isRTL } = useRTL();

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
    <VStack gap="$2">
      <HStack justifyContent="space-between" alignItems="center">
        <Text textAlign="left" size="sm" color="$typography">
          {t("alarm.settings.volume")}
        </Text>
        <Text size="sm" color="$typographySecondary">
          {volumePercentage}%
        </Text>
      </HStack>
      <HStack gap="$2" alignItems="center">
        <Icon
          as={isRTL ? Volume2 : VolumeX}
          size="sm"
          color={value === (isRTL ? 1 : 0) ? "$warning" : "$typographySecondary"}
        />
        <HStack flex={1} justifyContent="space-between" alignItems="center" paddingHorizontal="$2">
          <Pressable
            onPress={handleDecrease}
            width={44}
            height={44}
            borderRadius={999}
            backgroundColor="$backgroundMuted"
            alignItems="center"
            justifyContent="center">
            <Icon as={Minus} size="sm" color="$typography" />
          </Pressable>

          <HStack gap="$1" flex={1} justifyContent="center">
            {VOLUME_STEPS.map((step) => (
              <Pressable
                key={step}
                onPress={() => handleStepPress(step)}
                minWidth={28}
                minHeight={28}
                alignItems="center"
                justifyContent="center">
                <Box
                  width={12}
                  height={12}
                  borderRadius={999}
                  backgroundColor={value >= step ? "$accentPrimary" : "$backgroundMuted"}
                />
              </Pressable>
            ))}
          </HStack>

          <Pressable
            onPress={handleIncrease}
            width={44}
            height={44}
            borderRadius={999}
            backgroundColor="$backgroundMuted"
            alignItems="center"
            justifyContent="center">
            <Icon as={Plus} size="sm" color="$typography" />
          </Pressable>
        </HStack>
        <Icon as={isRTL ? VolumeX : Volume2} size="sm" color="$typographySecondary" />
      </HStack>
    </VStack>
  );
};

export default VolumeSlider;
