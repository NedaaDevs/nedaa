import { useCallback, useEffect, useRef, useState } from "react";
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
import ReportProblemModal from "@/components/ReportProblemModal";
import { AppLogger } from "@/utils/appLogger";
import { readPendingReport, clearPendingReport } from "@/utils/crashHandler";

const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

// Shown once on the launch after a JS crash (a sentinel was written by the crash hook).
// "Send report" opens the same report sheet used everywhere else — same channels, same
// payload — so the crash flow shares logs identically to the bug button.
const CrashReportPrompt = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const ref = useRef<BottomSheetModal>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const pendingSend = useRef(false);

  useEffect(() => {
    const pending = readPendingReport();
    if (pending && Date.now() - pending.ts < MAX_AGE_MS) {
      ref.current?.present();
    } else if (pending) {
      clearPendingReport(); // stale crash — drop it silently
    }
  }, []);

  const send = useCallback(() => {
    pendingSend.current = true;
    clearPendingReport();
    ref.current?.dismiss(); // onDismiss opens the report sheet once the prompt is gone
  }, []);

  const dismiss = useCallback(() => {
    clearPendingReport();
    ref.current?.dismiss();
  }, []);

  // Clear on any dismissal so it shows once; open the report sheet if Send was tapped.
  const onPromptDismiss = useCallback(() => {
    clearPendingReport();
    if (pendingSend.current) {
      pendingSend.current = false;
      setReportOpen(true);
    }
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
    <>
      <BottomSheetModal
        ref={ref}
        onDismiss={onPromptDismiss}
        enablePanDownToClose
        enableDynamicSizing
        backdropComponent={renderBackdrop}
        backgroundStyle={{
          backgroundColor: theme.backgroundSecondary?.val ?? theme.background?.val,
        }}
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

      <ReportProblemModal
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
        emailSubject={t("settings.shareLogs.emailSubject")}
        getReportText={() => AppLogger.buildReport({ category: "Crash" })}
        getSummaryText={() => AppLogger.buildSummary({})}
        baseName="crash"
      />
    </>
  );
};

export default CrashReportPrompt;
