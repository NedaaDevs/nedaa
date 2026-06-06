import { YStack } from "tamagui";
import { useTranslation } from "react-i18next";
import { CircleCheck } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { useQuranChromeColors } from "@/hooks/useQuranChromeColors";

// Placeholder — the Khatmah (completion) tracker is its own feature, pending.
export const KhatmahTab = () => {
  const { t } = useTranslation();
  const chrome = useQuranChromeColors();
  return (
    <YStack flex={1} alignItems="center" justifyContent="center" gap="$3" padding="$6">
      <CircleCheck color={chrome.subtleText} size={40} strokeWidth={1.6} />
      <Text fontSize={16} fontWeight="700" color={chrome.text}>
        {t("quran.library.khatmah")}
      </Text>
      <Text fontSize={13} color={chrome.subtleText}>
        {t("quran.library.comingSoon")}
      </Text>
    </YStack>
  );
};
