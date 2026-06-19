import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { useTheme } from "tamagui";

import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Pressable } from "@/components/ui/pressable";
import { Button } from "@/components/ui/button";
import { AppLogger } from "@/utils/appLogger";
import { readPendingReport, clearPendingReport } from "@/utils/crashHandler";

const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

// Shown once on the launch after a JS crash (a sentinel was written by the crash hook).
// Offers to share the diagnostic bundle; the sentinel is cleared on any dismissal so it
// never reappears for the same crash.
const CrashReportPrompt = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const ref = useRef<BottomSheetModal>(null);

  useEffect(() => {
    const pending = readPendingReport();
    if (pending && Date.now() - pending.ts < MAX_AGE_MS) {
      ref.current?.present();
    } else if (pending) {
      clearPendingReport(); // stale crash — drop it silently
    }
  }, []);

  const send = useCallback(() => {
    clearPendingReport();
    ref.current?.dismiss();
    void AppLogger.shareReport({ category: "Crash" });
  }, []);

  const dismiss = useCallback(() => {
    clearPendingReport();
    ref.current?.dismiss();
  }, []);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
      />
    ),
    []
  );

  return (
    <BottomSheetModal
      ref={ref}
      // Clear on any dismissal (swipe / backdrop / back / button) so it shows once.
      onDismiss={clearPendingReport}
      enablePanDownToClose
      enableDynamicSizing
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: theme.backgroundSecondary?.val ?? theme.background?.val }}
      handleIndicatorStyle={{
        backgroundColor: theme.typographySecondary?.val ?? theme.outline?.val,
      }}>
      <BottomSheetView
        style={{
          paddingHorizontal: 20,
          paddingTop: 4,
          paddingBottom: Math.max(insets.bottom, 16) + 8,
        }}>
        <VStack gap="$3">
          <Text size="lg" fontWeight="700" color="$typography" textAlign="center">
            {t("crashPrompt.title")}
          </Text>
          <Text size="sm" color="$typographySecondary" textAlign="center" lineHeight={20}>
            {t("crashPrompt.body")}
          </Text>

          <Button
            onPress={send}
            width="100%"
            accessibilityRole="button"
            accessibilityLabel={t("crashPrompt.send")}>
            <Button.Text>{t("crashPrompt.send")}</Button.Text>
          </Button>

          <Pressable
            onPress={dismiss}
            minHeight={44}
            alignItems="center"
            justifyContent="center"
            accessibilityRole="button"
            accessibilityLabel={t("crashPrompt.dismiss")}>
            <Text size="sm" color="$typographySecondary">
              {t("crashPrompt.dismiss")}
            </Text>
          </Pressable>
        </VStack>
      </BottomSheetView>
    </BottomSheetModal>
  );
};

export default CrashReportPrompt;
