import { useTranslation } from "react-i18next";
import { Check } from "lucide-react-native";

// Components
import { Background } from "@/components/ui/background";
import TopBar from "@/components/TopBar";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";

// Stores
import { usePreferencesStore } from "@/stores/preferences";

// Enums / constants
import { TextSize, type TextSizeValue } from "@/enums/app";
import { TEXT_SIZE_MULTIPLIERS } from "@/constants/TextSize";

const OPTIONS: { value: TextSizeValue; labelKey: string }[] = [
  { value: TextSize.DEFAULT, labelKey: "settings.textSize.options.default" },
  { value: TextSize.LARGE, labelKey: "settings.textSize.options.large" },
  { value: TextSize.XLARGE, labelKey: "settings.textSize.options.xlarge" },
  { value: TextSize.MAX, labelKey: "settings.textSize.options.max" },
];

const TextSizeSettings = () => {
  const { t } = useTranslation();
  const textSize = usePreferencesStore((s) => s.textSize);
  const setTextSize = usePreferencesStore((s) => s.setTextSize);

  return (
    <Background>
      <TopBar title="settings.textSize.title" href="/settings/preferences" backOnClick />
      <VStack padding="$4" gap="$2">
        {OPTIONS.map(({ value, labelKey }) => {
          const selected = textSize === value;
          return (
            <Pressable
              key={value}
              onPress={() => setTextSize(value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={t("a11y.textSize.option", { name: t(labelKey) })}
              minHeight={44}
              paddingHorizontal="$4"
              paddingVertical="$3"
              borderRadius="$4"
              backgroundColor={selected ? "$backgroundInteractive" : "$backgroundSecondary"}>
              <HStack alignItems="center" justifyContent="space-between" gap="$3">
                <VStack flexShrink={1} gap="$0.5">
                  <Text size="md" fontWeight="600">
                    {t(labelKey)}
                  </Text>
                  {/* The preview renders at the row's own multiplier, not the active preset. */}
                  <Text
                    size="sm"
                    color="$typographySecondary"
                    scaleOverride={TEXT_SIZE_MULTIPLIERS[value]}>
                    {t("settings.textSize.preview")}
                  </Text>
                </VStack>
                {selected && <Icon as={Check} size="lg" color="$primary" />}
              </HStack>
            </Pressable>
          );
        })}
      </VStack>
    </Background>
  );
};

export default TextSizeSettings;
