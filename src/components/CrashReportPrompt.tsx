import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
  BottomSheetTextInput,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { useTheme } from "tamagui";

import { WifiOff } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { readPendingReport, clearPendingReport } from "@/utils/crashHandler";
import { usePendingReportStore } from "@/stores/pendingReport";
import { submitFeedback, buildLogAttachment, generateClientKey } from "@/services/feedback";
import { useIsOffline } from "@/hooks/useIsOffline";
import { Report } from "@/types/feedback";

const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

type Status = "idle" | "submitting" | "success" | "error";

// Shown once on the launch after a crash (a sentinel was written by the crash hook/native drain).
// "Send report" submits a crash report directly in one tap — the crash context is already known,
// so unlike the bug/feedback flow it does not open the full form.
const CrashReportPrompt = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const ref = useRef<BottomSheetModal>(null);
  const offline = useIsOffline();
  const [status, setStatus] = useState<Status>("idle");
  const [note, setNote] = useState("");
  // Reused across retries so an ambiguous failure can't produce a duplicate report.
  const clientKey = useRef<string | null>(null);

  // Re-checked when the sentinel nonce bumps: the native-diagnostics drain writes the sentinel
  // asynchronously, after this effect's first run, so depend on the nonce to catch it this launch.
  const pendingNonce = usePendingReportStore((s) => s.nonce);

  useEffect(() => {
    const pending = readPendingReport();
    if (pending && Date.now() - pending.ts < MAX_AGE_MS) {
      ref.current?.present();
    } else if (pending) {
      clearPendingReport(); // stale crash — drop it silently
    }
  }, [pendingNonce]);

  const send = useCallback(async () => {
    setStatus("submitting");
    try {
      if (!clientKey.current) clientKey.current = generateClientKey();
      const logs = await buildLogAttachment({ category: "Crash" });
      await submitFeedback({
        type: Report.CRASH,
        message: note.trim() || undefined,
        attachments: [logs],
        clientKey: clientKey.current,
      });
      clearPendingReport();
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }, [note]);

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

  const submitting = status === "submitting";

  return (
    <BottomSheetModal
      ref={ref}
      onDismiss={clearPendingReport}
      enablePanDownToClose={!submitting}
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
        {status === "success" ? (
          <VStack gap="$3">
            <Text size="lg" fontWeight="700" color="$typography" textAlign="center">
              {t("feedback.success.title")}
            </Text>
            <Text
              size="sm"
              color="$typographySecondary"
              textAlign="center"
              lineHeight={20}
              accessibilityLiveRegion="polite">
              {t("feedback.success.body")}
            </Text>
            <Button
              onPress={dismiss}
              width="100%"
              accessibilityRole="button"
              accessibilityLabel={t("feedback.success.done")}>
              <Button.Text>{t("feedback.success.done")}</Button.Text>
            </Button>
          </VStack>
        ) : (
          <VStack gap="$3">
            <Text size="lg" fontWeight="700" color="$typography" textAlign="center">
              {t("crashPrompt.title")}
            </Text>
            <Text size="sm" color="$typographySecondary" textAlign="center" lineHeight={20}>
              {t("crashPrompt.body")}
            </Text>

            <BottomSheetTextInput
              value={note}
              onChangeText={setNote}
              editable={!submitting}
              placeholder={t("crashPrompt.notePlaceholder")}
              placeholderTextColor={theme.typographySecondary?.val}
              multiline
              accessibilityLabel={t("crashPrompt.notePlaceholder")}
              style={{
                color: theme.typography?.val,
                backgroundColor: theme.backgroundMuted?.val ?? theme.background?.val,
                borderColor: theme.borderColor?.val,
                borderWidth: 1,
                borderRadius: 12,
                padding: 12,
                minHeight: 72,
                fontSize: 15,
                textAlignVertical: "top",
              }}
            />

            {offline ? (
              <HStack
                gap="$2"
                alignItems="center"
                justifyContent="center"
                accessibilityLiveRegion="polite">
                <Icon as={WifiOff} size={16} color="$typographySecondary" />
                <Text size="sm" color="$typographySecondary">
                  {t("feedback.offline")}
                </Text>
              </HStack>
            ) : null}

            {status === "error" ? (
              <Text size="sm" color="$error" textAlign="center" accessibilityLiveRegion="assertive">
                {t("feedback.error")}
              </Text>
            ) : null}

            <Button
              onPress={send}
              width="100%"
              disabled={submitting || offline}
              accessibilityRole="button"
              accessibilityLabel={t(status === "error" ? "feedback.retry" : "crashPrompt.send")}>
              {submitting ? (
                <Spinner color="$accentPrimary" />
              ) : (
                <Button.Text>
                  {t(status === "error" ? "feedback.retry" : "crashPrompt.send")}
                </Button.Text>
              )}
            </Button>

            <Pressable
              onPress={dismiss}
              disabled={submitting}
              minHeight={44}
              alignItems="center"
              justifyContent="center"
              opacity={submitting ? 0.5 : 1}
              accessibilityRole="button"
              accessibilityLabel={t("crashPrompt.dismiss")}>
              <Text size="sm" color="$typographySecondary">
                {t("crashPrompt.dismiss")}
              </Text>
            </Pressable>
          </VStack>
        )}
      </BottomSheetView>
    </BottomSheetModal>
  );
};

export default CrashReportPrompt;
