import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView } from "react-native";
import { XStack, YStack } from "tamagui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MotiView } from "moti";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight, Signal } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { MushafVersion, DownloadStatus } from "@/enums/quran";
import { QuranManifestService } from "@/services/quran-manifest";
import { QuranDownload } from "@/services/quran-download";
import { useQuranStore } from "@/stores/quran";
import { useRTL } from "@/contexts/RTLContext";
import { useQuranChromeColors } from "@/hooks/useQuranChromeColors";
import { useIsCellular } from "@/hooks/useIsCellular";
import VersionCard from "@/components/quran/VersionCard";
import TextModeCard from "@/components/quran/TextModeCard";
import type { QuranManifestVersion } from "@/types/quran";

const VERSION_ORDER = [MushafVersion.V2, MushafVersion.V4, MushafVersion.V1];
// Sentinel selection id for the no-download Text option (not a manifest version).
const TEXT_MODE_ID = "text";

interface VersionSelectionScreenProps {
  onSelectVersion: (version: QuranManifestVersion) => void;
  onSelectTextMode: () => void;
  // When set, a back affordance returns to the caller (the "Download more" flow).
  // Omitted in onboarding, where there is nothing to go back to.
  onBack?: () => void;
}

const VersionSelectionScreen = ({
  onSelectVersion,
  onSelectTextMode,
  onBack,
}: VersionSelectionScreenProps) => {
  const { t } = useTranslation();
  const { isRTL } = useRTL();
  const insets = useSafeAreaInsets();
  const chrome = useQuranChromeColors();
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;
  const isCellular = useIsCellular();
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

  const textSelected = selectedId === TEXT_MODE_ID;
  const selected = versions.find((v) => v.id === selectedId) ?? null;
  const hasSelection = textSelected || selected !== null;
  const selectedInstalled = selectedId
    ? downloads[selectedId as MushafVersion]?.status === DownloadStatus.COMPLETE
    : false;
  const wantsDark = !!selected && selected.id === MushafVersion.V4 && v4Dark && !selectedInstalled;
  const ctaSizeMB =
    selected && wantsDark && selected.darkBundle
      ? Math.round(selected.bundle.sizeMB + selected.darkBundle.sizeMB)
      : (selected?.totalSizeMB ?? 0);

  const handleCta = () => {
    if (textSelected) {
      onSelectTextMode();
      return;
    }
    if (!selected) return;
    onSelectVersion(selected);
    if (wantsDark) QuranDownload.startDark(selected.id as MushafVersion);
  };

  // Both the Text option and an already-installed edition just open the reader;
  // an un-installed edition shows its download size; nothing selected prompts a
  // choice.
  const resolveCtaLabel = (): string => {
    if (textSelected || selectedInstalled) return t("quran.onboarding.startReading");
    if (!selected) return t("quran.download.selectEdition");
    return t("quran.download.cta", {
      name: t(`quran.version.${selected.id}`),
      size: t("quran.download.sizeMB", { size: ctaSizeMB }),
    });
  };
  const ctaLabel = resolveCtaLabel();

  return (
    <YStack flex={1} backgroundColor={chrome.background}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + (onBack ? 8 : 24),
          paddingBottom: insets.bottom + 116,
          paddingHorizontal: 20,
        }}>
        {onBack && (
          <XStack justifyContent="flex-start" marginBottom="$2">
            <Pressable
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel={t("common.back")}
              hitSlop={8}
              style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
              <BackIcon size={24} color={chrome.text} />
            </Pressable>
          </XStack>
        )}
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

          {/* Text mode — no download, a peer to the editions */}
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ delay: 300 + versions.length * 100 }}
            style={{ width: "100%" }}>
            <TextModeCard selected={textSelected} onSelect={() => setSelectedId(TEXT_MODE_ID)} />
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
        {selected && !selectedInstalled && isCellular && (
          <XStack alignItems="center" justifyContent="center" gap="$1.5" paddingBottom="$2">
            <Signal size={13} color={chrome.subtleText} />
            <Text fontSize={12.5} color={chrome.subtleText}>
              {t("quran.download.cellularWarning", {
                size: t("quran.download.sizeMB", { size: ctaSizeMB }),
              })}
            </Text>
          </XStack>
        )}
        <Pressable
          onPress={handleCta}
          disabled={!hasSelection}
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
          accessibilityState={{ disabled: !hasSelection }}>
          <YStack
            backgroundColor={chrome.accent}
            opacity={hasSelection ? 1 : 0.45}
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
