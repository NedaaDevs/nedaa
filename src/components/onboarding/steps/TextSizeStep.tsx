import { useEffect } from "react";
import { PixelRatio } from "react-native";
import { useTranslation } from "react-i18next";

import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Pressable } from "@/components/ui/pressable";
import { TextSize, type TextSizeValue } from "@/enums/app";
import { nearestTextSize, TEXT_SIZE_MULTIPLIERS } from "@/constants/TextSize";
import { usePreferencesStore } from "@/stores/preferences";

const OPTIONS: { value: TextSizeValue; labelKey: string }[] = [
  { value: TextSize.DEFAULT, labelKey: "settings.textSize.options.default" },
  { value: TextSize.LARGE, labelKey: "settings.textSize.options.large" },
  { value: TextSize.XLARGE, labelKey: "settings.textSize.options.xlarge" },
  { value: TextSize.MAX, labelKey: "settings.textSize.options.max" },
];

type TextSizeStepProps = {
  onNext: () => void;
};

const TextSizeStep = ({ onNext }: TextSizeStepProps) => {
  const { t } = useTranslation();
  const textSize = usePreferencesStore((s) => s.textSize);
  const offerHandled = usePreferencesStore((s) => s.textSizeOfferHandled);
  const setTextSize = usePreferencesStore((s) => s.setTextSize);
  const markOfferHandled = usePreferencesStore((s) => s.markTextSizeOfferHandled);

  // Seeded from the device font scale so the screen opens at the highlighted row's size.
  // The handled flag stops a remount from overwriting a choice already made.
  useEffect(() => {
    if (!offerHandled) setTextSize(nearestTextSize(PixelRatio.getFontScale()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rows apply their own size on press; Continue only settles the offer.
  const apply = () => {
    markOfferHandled();
    onNext();
  };

  return (
    <VStack flex={1} justifyContent="center" paddingHorizontal="$8" gap="$5">
      <VStack gap="$2" alignItems="center">
        <Text size="3xl" bold textAlign="center">
          {t("onboarding.textSize.title")}
        </Text>
        <Text size="lg" color="$typographySecondary" textAlign="center">
          {t("onboarding.textSize.body")}
        </Text>
      </VStack>

      <VStack gap="$2">
        {OPTIONS.map(({ value, labelKey }) => (
          <Pressable
            key={value}
            onPress={() => setTextSize(value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: textSize === value }}
            accessibilityLabel={t("a11y.textSize.option", { name: t(labelKey) })}
            minHeight={44}
            paddingHorizontal="$4"
            paddingVertical="$2.5"
            borderRadius="$4"
            borderWidth={1}
            borderColor={textSize === value ? "$primary" : "$outline"}>
            <HStack alignItems="center" justifyContent="space-between">
              {/* Each label previews its own multiplier, not the active preset. */}
              <Text size="md" fontWeight="600" scaleOverride={TEXT_SIZE_MULTIPLIERS[value]}>
                {t(labelKey)}
              </Text>
            </HStack>
          </Pressable>
        ))}
      </VStack>

      <Button onPress={apply} size="lg">
        <Button.Text fontWeight="500">{t("onboarding.textSize.continue")}</Button.Text>
      </Button>
    </VStack>
  );
};

export default TextSizeStep;
