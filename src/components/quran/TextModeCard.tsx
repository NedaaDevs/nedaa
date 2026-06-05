import { Pressable } from "react-native";
import { XStack, YStack } from "tamagui";
import { useTranslation } from "react-i18next";
import { Check, Type } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { useQuranChromeColors, type QuranChromeColors } from "@/hooks/useQuranChromeColors";

interface TextModeCardProps {
  selected: boolean;
  onSelect: () => void;
}

// Text mode as a first-class peer to the edition cards: it needs no download and
// is the only mode whose text size adjusts (the image mushaf is fixed) — so it's
// surfaced with its own benefits rather than a thin afterthought row.
const TextModeCard = ({ selected, onSelect }: TextModeCardProps) => {
  const { t } = useTranslation();
  const chrome = useQuranChromeColors();

  const chips = [
    t("quran.onboarding.textModeNoDownload"),
    t("quran.onboarding.textModeDesc"),
    t("quran.onboarding.textModeThemes"),
  ];

  return (
    <Pressable
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={t("quran.onboarding.textMode")}
      style={{
        borderWidth: 2,
        borderColor: selected ? chrome.accent : chrome.cardBorder,
        borderRadius: 18,
        backgroundColor: chrome.cardBackground,
        padding: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
      }}>
      <XStack gap={14} alignItems="flex-start">
        <YStack
          width={54}
          height={54}
          borderRadius={9}
          backgroundColor={chrome.background}
          alignItems="center"
          justifyContent="center">
          <Type size={24} color={chrome.accent} />
        </YStack>

        <YStack flex={1} gap="$1.5">
          <XStack alignItems="flex-start" gap="$2">
            <YStack flex={1}>
              <Text fontSize={17} fontWeight="700">
                {t("quran.onboarding.textMode")}
              </Text>
              <Text color={chrome.subtleText} fontSize={12.5} lineHeight={17}>
                {t("quran.onboarding.textModeCardDesc")}
              </Text>
            </YStack>
            <Radio on={selected} accent={chrome.accent} border={chrome.cardBorder} />
          </XStack>

          <XStack gap="$1.5" flexWrap="wrap">
            {chips.map((label) => (
              <Chip key={label} label={label} chrome={chrome} />
            ))}
          </XStack>
        </YStack>
      </XStack>
    </Pressable>
  );
};

const Radio = ({
  on,
  accent,
  border,
}: {
  on: boolean;
  accent: `#${string}`;
  border: `#${string}`;
}) => (
  <YStack
    width={22}
    height={22}
    borderRadius={99}
    borderWidth={2}
    borderColor={on ? accent : border}
    backgroundColor={on ? accent : "transparent"}
    alignItems="center"
    justifyContent="center">
    {on && <Check size={12} color="#fff" />}
  </YStack>
);

const Chip = ({ label, chrome }: { label: string; chrome: QuranChromeColors }) => (
  <XStack
    backgroundColor={chrome.background}
    borderRadius={99}
    paddingHorizontal="$2.5"
    paddingVertical="$1"
    borderWidth={1}
    borderColor={chrome.cardBorder}>
    <Text fontSize={11} fontWeight="600" color={chrome.subtleText}>
      {label}
    </Text>
  </XStack>
);

export default TextModeCard;
