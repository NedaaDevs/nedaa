import { Compass, LocateFixed, type LucideIcon } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { HStack } from "@/components/ui/hstack";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

type CompassModeSwitchProps = {
  isQiblaMode: boolean;
  onChooseQibla: () => void;
  onChooseCompassOnly: () => void;
};

const ModeOption = ({
  selected,
  label,
  accessibilityLabel,
  accessibilityHint,
  icon,
  onPress,
}: {
  selected: boolean;
  label: string;
  accessibilityLabel: string;
  accessibilityHint: string;
  icon: LucideIcon;
  onPress: () => void;
}) => (
  <Pressable
    flex={1}
    minHeight={44}
    borderRadius="$6"
    alignItems="center"
    justifyContent="center"
    backgroundColor={selected ? "$primary" : "$backgroundSecondary"}
    onPress={() => {
      if (!selected) onPress();
    }}
    accessibilityRole="radio"
    accessibilityLabel={accessibilityLabel}
    accessibilityHint={accessibilityHint}
    accessibilityState={{ checked: selected, selected }}>
    <HStack alignItems="center" justifyContent="center" gap="$2" paddingHorizontal="$3">
      <Icon as={icon} size="sm" color={selected ? "$typographyContrast" : "$typographySecondary"} />
      <Text fontWeight="600" color={selected ? "$typographyContrast" : "$typographySecondary"}>
        {label}
      </Text>
    </HStack>
  </Pressable>
);

export const CompassModeSwitch = ({
  isQiblaMode,
  onChooseQibla,
  onChooseCompassOnly,
}: CompassModeSwitchProps) => {
  const { t } = useTranslation();

  return (
    <VStack width="100%" maxWidth={420} gap="$2">
      <HStack
        width="100%"
        gap="$1"
        padding="$1"
        borderRadius="$7"
        backgroundColor="$backgroundSecondary"
        accessibilityRole="radiogroup"
        accessibilityLabel={t("a11y.compass.modeSelector")}>
        <ModeOption
          selected={isQiblaMode}
          label={t("compass.mode.qibla")}
          accessibilityLabel={t("a11y.compass.selectQiblaMode")}
          accessibilityHint={t("a11y.compass.selectQiblaModeHint")}
          icon={LocateFixed}
          onPress={onChooseQibla}
        />
        <ModeOption
          selected={!isQiblaMode}
          label={t("compass.mode.compassOnly")}
          accessibilityLabel={t("a11y.compass.selectCompassMode")}
          accessibilityHint={t("a11y.compass.selectCompassModeHint")}
          icon={Compass}
          onPress={onChooseCompassOnly}
        />
      </HStack>
      <Text size="xs" color="$typographySecondary" textAlign="center">
        {t(isQiblaMode ? "compass.mode.qiblaDescription" : "compass.mode.compassOnlyDescription")}
      </Text>
    </VStack>
  );
};
