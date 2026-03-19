import { Pressable, StyleSheet } from "react-native";
import { XStack } from "tamagui";
import { useTranslation } from "react-i18next";
import { Minus, Plus } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { FONT_SIZE_MIN, FONT_SIZE_MAX, FONT_SIZE_STEP } from "@/constants/Quran";
import { useHaptic } from "@/hooks/useHaptic";

interface FontSizeControlsProps {
  fontSize: number;
  onFontSizeChange: (size: number) => void;
}

const FontSizeControls = ({ fontSize, onFontSizeChange }: FontSizeControlsProps) => {
  const { t } = useTranslation();
  const haptic = useHaptic("light");

  const canDecrease = fontSize > FONT_SIZE_MIN;
  const canIncrease = fontSize < FONT_SIZE_MAX;

  const decrease = () => {
    if (!canDecrease) return;
    haptic();
    onFontSizeChange(fontSize - FONT_SIZE_STEP);
  };

  const increase = () => {
    if (!canIncrease) return;
    haptic();
    onFontSizeChange(fontSize + FONT_SIZE_STEP);
  };

  return (
    <XStack
      alignItems="center"
      gap="$2"
      backgroundColor="rgba(0,0,0,0.3)"
      borderRadius="$4"
      paddingHorizontal="$2"
      paddingVertical="$1">
      <Pressable
        onPress={decrease}
        disabled={!canDecrease}
        accessibilityRole="button"
        accessibilityLabel={t("a11y.quran.decreaseFontSize")}
        style={[styles.button, !canDecrease && styles.disabled]}>
        <Minus color="white" size={16} />
      </Pressable>

      <Text
        color="white"
        fontSize={12}
        fontWeight="600"
        minWidth={24}
        textAlign="center"
        accessibilityLabel={t("a11y.quran.fontSize", { size: fontSize })}>
        {fontSize}
      </Text>

      <Pressable
        onPress={increase}
        disabled={!canIncrease}
        accessibilityRole="button"
        accessibilityLabel={t("a11y.quran.increaseFontSize")}
        style={[styles.button, !canIncrease && styles.disabled]}>
        <Plus color="white" size={16} />
      </Pressable>
    </XStack>
  );
};

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: {
    opacity: 0.3,
  },
});

export default FontSizeControls;
