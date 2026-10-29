import type { ReactNode } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { SCREEN_GUTTER } from "@/components/ui/screen-content";
import { SkyOccluder } from "@/components/ui/sky-background";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HIDDEN_FROM_READER } from "@/constants/Accessibility";
import { FRAME_MODE, ONBOARDING_PART, type FrameMode } from "@/constants/Onboarding";

const TRACK_HEIGHT = 3;

type Props = {
  /** Bare draws the step on the sky alone; chrome adds the bars around it. */
  mode: FrameMode;
  /** "N of M"; the heading speaks it, so the bar is hidden from readers. */
  progress: string;
  /** How far through the column, 0 to 1. */
  fraction: number;
  canGoBack: boolean;
  busy: boolean;
  /** False when the step draws its own actions in place of the primary. */
  showPrimary: boolean;
  primaryLabel: string;
  onPrimary: () => void;
  onBack: () => void;
  onSkip: () => void;
  /** VoiceOver's magic tap while focus is anywhere inside the frame. */
  onMagicTap?: () => void;
  /** Drawn in place of Back and Continue, such as a day run's player. */
  bar?: ReactNode;
  children: ReactNode;
};

/** The step between the top bar and the bottom bar; bare leaves both out. */
export const OnboardingFrame = ({
  mode,
  progress,
  fraction,
  canGoBack,
  busy,
  showPrimary,
  primaryLabel,
  onPrimary,
  onBack,
  onSkip,
  onMagicTap,
  bar,
  children,
}: Props) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const chrome = mode === FRAME_MODE.CHROME;

  return (
    // VoiceOver's escape gesture moves back, as the back control does.
    <View
      testID={ONBOARDING_PART.FRAME}
      style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }}
      onAccessibilityEscape={onBack}
      onMagicTap={onMagicTap}>
      {chrome ? (
        <SkyOccluder>
          <HStack
            paddingHorizontal={SCREEN_GUTTER}
            minHeight="$target"
            alignItems="center"
            justifyContent="space-between">
            <Text size="lg" bold typography="title" color="$fg">
              {t("brand.name")}
            </Text>
            <Pressable
              testID={ONBOARDING_PART.SKIP}
              accessibilityRole="button"
              accessibilityLabel={t("onboarding.skip")}
              disabled={busy}
              onPress={onSkip}
              minHeight="$target"
              minWidth="$target"
              paddingHorizontal="$2"
              alignItems="center"
              justifyContent="center">
              <Text size="sm" fontWeight="600" color="$mutedSky">
                {t("onboarding.skip")}
              </Text>
            </Pressable>
          </HStack>
          <VStack paddingHorizontal={SCREEN_GUTTER} gap="$1.5" {...HIDDEN_FROM_READER}>
            <Text testID={ONBOARDING_PART.PROGRESS} size="xs" numeric color="$mutedSky">
              {progress}
            </Text>
            <Box height={TRACK_HEIGHT} borderRadius="$pill" backgroundColor="$border">
              <Box
                testID={ONBOARDING_PART.PROGRESS_FILL}
                height={TRACK_HEIGHT}
                width={`${Math.round(fraction * 100)}%`}
                borderRadius="$pill"
                backgroundColor="$accent"
              />
            </Box>
          </VStack>
        </SkyOccluder>
      ) : null}

      <Box flex={1}>{children}</Box>

      {chrome && bar ? (
        <Box paddingHorizontal={SCREEN_GUTTER} paddingTop="$2" paddingBottom="$2">
          {bar}
        </Box>
      ) : chrome ? (
        <HStack
          paddingHorizontal={SCREEN_GUTTER}
          paddingTop="$2"
          paddingBottom="$2"
          gap="$3"
          alignItems="center">
          {canGoBack ? (
            <Pressable
              testID={ONBOARDING_PART.BACK}
              accessibilityRole="button"
              accessibilityLabel={t("onboarding.back")}
              disabled={busy}
              onPress={onBack}
              minHeight="$target"
              minWidth="$target"
              paddingHorizontal="$3"
              alignItems="center"
              justifyContent="center">
              <Text size="md" fontWeight="600" color="$fg">
                {t("onboarding.back")}
              </Text>
            </Pressable>
          ) : null}
          {showPrimary ? (
            <Button
              testID={ONBOARDING_PART.CONTINUE}
              flex={1}
              action="primary"
              variant="solid"
              size="lg"
              disabled={busy}
              onPress={onPrimary}
              accessibilityRole="button"
              accessibilityLabel={primaryLabel}>
              <Button.Text>{primaryLabel}</Button.Text>
            </Button>
          ) : null}
        </HStack>
      ) : null}
    </View>
  );
};
