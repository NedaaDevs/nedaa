import { Pressable } from "react-native";
import { XStack, YStack } from "tamagui";
import { useTranslation } from "react-i18next";

import { Text } from "@/components/ui/text";
import { RECOMMENDED_VERSION, QURAN_UI_COLORS } from "@/constants/Quran";
import type { QuranManifestVersion } from "@/types/quran";

interface VersionCardProps {
  version: QuranManifestVersion;
  onDownload: (version: QuranManifestVersion) => void;
  disabled?: boolean;
}

const VersionCard = ({ version, onDownload, disabled }: VersionCardProps) => {
  const { t } = useTranslation();
  const isRecommended = version.id === RECOMMENDED_VERSION;

  const a11yLabel = isRecommended
    ? t("a11y.quran.versionCardRecommended", {
        name: version.name,
        size: version.totalSizeMB,
        year: version.yearGregorian,
      })
    : t("a11y.quran.versionCard", {
        name: version.name,
        size: version.totalSizeMB,
        year: version.yearGregorian,
      });

  return (
    <Pressable
      onPress={() => !disabled && onDownload(version)}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      style={{
        borderWidth: 1,
        borderColor: QURAN_UI_COLORS.cardBorder,
        borderRadius: 16,
        padding: 16,
        backgroundColor: QURAN_UI_COLORS.cardBackground,
        opacity: disabled ? 0.5 : 1,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
      }}>
      <YStack gap="$2">
        <XStack alignItems="center" gap="$2">
          <Text fontWeight="600" fontSize={16}>
            {version.name}
          </Text>
          {isRecommended && (
            <YStack
              backgroundColor={QURAN_UI_COLORS.accent}
              paddingHorizontal="$1.5"
              paddingVertical={2}
              borderRadius={99}>
              <Text color="#fff" fontSize={10} fontWeight="700">
                {t("quran.onboarding.recommended")}
              </Text>
            </YStack>
          )}
        </XStack>

        <Text color={QURAN_UI_COLORS.subtleText} fontSize={13}>
          {version.yearHijri} AH · {version.yearGregorian}
        </Text>

        <XStack justifyContent="space-between" alignItems="center">
          <Text color={QURAN_UI_COLORS.subtleText} fontSize={12}>
            {version.totalSizeMB} MB
          </Text>
          <YStack
            backgroundColor={QURAN_UI_COLORS.accent}
            paddingHorizontal="$3"
            paddingVertical="$1.5"
            borderRadius="$3">
            <Text color="#fff" fontWeight="600" fontSize={13}>
              {t("quran.onboarding.download")}
            </Text>
          </YStack>
        </XStack>
      </YStack>
    </Pressable>
  );
};

export default VersionCard;
