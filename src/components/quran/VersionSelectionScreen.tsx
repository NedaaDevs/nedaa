import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView } from "react-native";
import { XStack, YStack } from "tamagui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MotiView } from "moti";
import { useTranslation } from "react-i18next";
import { Type } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { MushafVersion, DownloadStatus } from "@/enums/quran";
import { QuranManifestService } from "@/services/quran-manifest";
import { QuranDownload } from "@/services/quran-download";
import { useQuranStore } from "@/stores/quran";
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
  const chrome = useQuranChromeColors();
  const downloads = useQuranStore((s) => s.versionDownloads);
  const [versions, setVersions] = useState<QuranManifestVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [v4Dark, setV4Dark] = useState(false);

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

  const selected = versions.find((v) => v.id === selectedId) ?? null;
  const selectedInstalled = selectedId
    ? downloads[selectedId as MushafVersion]?.status === DownloadStatus.COMPLETE
    : false;
  const wantsDark = !!selected && selected.id === MushafVersion.V4 && v4Dark && !selectedInstalled;
  const ctaSizeMB =
    selected && wantsDark && selected.darkBundle
      ? Math.round(selected.bundle.sizeMB + selected.darkBundle.sizeMB)
      : (selected?.totalSizeMB ?? 0);

  const handleCta = () => {
    if (!selected) return;
    onSelectVersion(selected);
    if (wantsDark) QuranDownload.startDark(selected.id as MushafVersion);
  };

  const ctaLabel = !selected
    ? t("quran.download.selectEdition")
    : selectedInstalled
      ? t("quran.onboarding.startReading")
      : t("quran.download.cta", { name: selected.name, size: `${ctaSizeMB} MB` });

  return (
    <YStack flex={1} backgroundColor={chrome.background}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 116,
          paddingHorizontal: 20,
        }}>
        <YStack gap="$4" alignItems="center">
          <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Text fontSize={28} textAlign="center">
              ﷽
            </Text>
          </MotiView>

          <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ delay: 150 }}>
            <YStack gap="$1" alignItems="center">
              <Text fontSize={22} fontWeight="700" textAlign="center">
                {t("quran.onboarding.title")}
              </Text>
              <Text fontSize={14} color={chrome.subtleText} textAlign="center">
                {t("quran.onboarding.subtitle")}
              </Text>
            </YStack>
          </MotiView>

          {versions.map((version, index) => (
            <MotiView
              key={version.id}
              from={{ opacity: 0, translateY: 20 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ delay: 300 + index * 100 }}
              style={{ width: "100%" }}>
              <VersionCard
                version={version}
                selected={selectedId === version.id}
                onSelect={(v) => setSelectedId(v.id)}
                v4Dark={v4Dark}
                setV4Dark={setV4Dark}
              />
            </MotiView>
          ))}

          {/* Text mode — no download */}
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ delay: 300 + versions.length * 100 }}
            style={{ width: "100%" }}>
            <Pressable
              onPress={onSelectTextMode}
              accessibilityRole="button"
              accessibilityLabel={t("quran.onboarding.textMode")}
              style={{
                borderWidth: 1,
                borderColor: chrome.cardBorder,
                borderRadius: 18,
                padding: 16,
                backgroundColor: chrome.cardBackground,
              }}>
              <XStack alignItems="center" gap="$2.5">
                <Type size={20} color={chrome.subtleText} />
                <YStack flex={1}>
                  <Text fontWeight="600" fontSize={16}>
                    {t("quran.onboarding.textMode")}
                  </Text>
                  <Text color={chrome.subtleText} fontSize={13}>
                    {t("quran.onboarding.textModeDesc")} · {t("quran.onboarding.noDownload")}
                  </Text>
                </YStack>
              </XStack>
            </Pressable>
          </MotiView>
        </YStack>
      </ScrollView>

      {/* Sticky CTA */}
      <YStack
        position="absolute"
        left={0}
        right={0}
        bottom={0}
        paddingHorizontal={20}
        paddingTop="$3"
        paddingBottom={insets.bottom + 16}
        backgroundColor={chrome.background}
        borderTopWidth={1}
        borderTopColor={chrome.cardBorder}>
        <Pressable
          onPress={handleCta}
          disabled={!selected}
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
          accessibilityState={{ disabled: !selected }}>
          <YStack
            backgroundColor={chrome.accent}
            opacity={selected ? 1 : 0.45}
            borderRadius={14}
            paddingVertical="$3.5"
            alignItems="center">
            <Text color="#fff" fontWeight="700" fontSize={15}>
              {ctaLabel}
            </Text>
          </YStack>
        </Pressable>
      </YStack>
    </YStack>
  );
};

export default VersionSelectionScreen;
