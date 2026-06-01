import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView } from "react-native";
import { XStack, YStack } from "tamagui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MotiView } from "moti";
import { useTranslation } from "react-i18next";
import { Type } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { MushafVersion } from "@/enums/quran";
import { QuranManifestService } from "@/services/quran-manifest";
import { useQuranChromeColors } from "@/hooks/useQuranChromeColors";
import VersionCard from "@/components/quran/VersionCard";
import type { QuranManifestVersion } from "@/types/quran";

const VERSION_ORDER = [MushafVersion.V2, MushafVersion.V4, MushafVersion.V1];

interface VersionSelectionScreenProps {
  onSelectVersion: (version: QuranManifestVersion) => void;
  onSelectTextMode: () => void;
}

const VersionSelectionScreen = ({
  onSelectVersion,
  onSelectTextMode,
}: VersionSelectionScreenProps) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [versions, setVersions] = useState<QuranManifestVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const chrome = useQuranChromeColors();

  useEffect(() => {
    const loadManifest = async () => {
      const fetched = await QuranManifestService.getVersions();
      const sorted = VERSION_ORDER.map((id) => fetched.find((v) => v.id === id)).filter(
        Boolean
      ) as QuranManifestVersion[];
      setVersions(sorted);
      setLoading(false);
    };
    loadManifest();
  }, []);

  if (loading) {
    return (
      <YStack
        flex={1}
        alignItems="center"
        justifyContent="center"
        backgroundColor={chrome.background}>
        <ActivityIndicator size="large" color={chrome.accent} />
      </YStack>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{
        paddingTop: insets.top + 24,
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: 20,
      }}
      style={{ backgroundColor: chrome.background }}>
      <YStack gap="$4" alignItems="center">
        {/* Bismillah */}
        <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0 }}>
          <Text fontSize={28} textAlign="center">
            ﷽
          </Text>
        </MotiView>

        {/* Heading */}
        <MotiView
          from={{ opacity: 0, translateY: 10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ delay: 200 }}>
          <YStack gap="$1" alignItems="center">
            <Text fontSize={22} fontWeight="700" textAlign="center">
              {t("quran.onboarding.title")}
            </Text>
            <Text fontSize={14} color={chrome.subtleText} textAlign="center">
              {t("quran.onboarding.subtitle")}
            </Text>
          </YStack>
        </MotiView>

        {/* Version Cards */}
        {versions.map((version, index) => (
          <MotiView
            key={version.id}
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ delay: 400 + index * 100 }}
            style={{ width: "100%" }}>
            <VersionCard version={version} onDownload={onSelectVersion} />
          </MotiView>
        ))}

        {/* Text Mode Card */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ delay: 400 + versions.length * 100 }}
          style={{ width: "100%" }}>
          <Pressable
            onPress={onSelectTextMode}
            accessibilityRole="button"
            accessibilityLabel={t("quran.onboarding.textMode")}
            style={{
              borderWidth: 1,
              borderColor: chrome.cardBorder,
              borderRadius: 16,
              padding: 16,
              backgroundColor: chrome.cardBackground,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 8,
              elevation: 2,
            }}>
            <YStack gap="$2">
              <XStack alignItems="center" gap="$2">
                <Type size={20} color={chrome.subtleText} />
                <Text fontWeight="600" fontSize={16}>
                  {t("quran.onboarding.textMode")}
                </Text>
              </XStack>
              <Text color={chrome.subtleText} fontSize={13}>
                {t("quran.onboarding.textModeDesc")}
              </Text>
              <XStack justifyContent="space-between" alignItems="center">
                <Text color={chrome.subtleText} fontSize={12}>
                  {t("quran.onboarding.noDownload")}
                </Text>
                <YStack
                  backgroundColor={chrome.accent}
                  paddingHorizontal="$3"
                  paddingVertical="$1.5"
                  borderRadius="$3">
                  <Text color="#fff" fontWeight="600" fontSize={13}>
                    {t("quran.onboarding.startReading")}
                  </Text>
                </YStack>
              </XStack>
            </YStack>
          </Pressable>
        </MotiView>
      </YStack>
    </ScrollView>
  );
};

export default VersionSelectionScreen;
