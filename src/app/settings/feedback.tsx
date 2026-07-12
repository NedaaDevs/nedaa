import { useCallback, useMemo, useState } from "react";
import { ScrollView } from "react-native";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { router, useLocalSearchParams } from "expo-router";

import { AlertTriangle, Bug, Lightbulb, MessageCircle, FileText, Check } from "lucide-react-native";

import { Background } from "@/components/ui/background";
import TopBar from "@/components/TopBar";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Pressable } from "@/components/ui/pressable";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";

import { submitFeedback, buildLogAttachment } from "@/services/feedback";
import { Report, type ReportType } from "@/types/feedback";

type SubmitStatus = "idle" | "submitting" | "success" | "error";

const TYPES: { type: ReportType; icon: typeof Bug; labelKey: string }[] = [
  { type: Report.CRASH, icon: AlertTriangle, labelKey: "feedback.type.crash" },
  { type: Report.BUG, icon: Bug, labelKey: "feedback.type.bug" },
  { type: Report.FEATURE, icon: Lightbulb, labelKey: "feedback.type.feature" },
  { type: Report.OTHER, icon: MessageCircle, labelKey: "feedback.type.other" },
];

// Logs are meaningful only for something-is-wrong reports.
const logsDefaultFor = (type: ReportType): boolean => type === Report.CRASH || type === Report.BUG;

const FeedbackScreen = () => {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const params = useLocalSearchParams<{ type?: ReportType }>();

  const [type, setType] = useState<ReportType | null>(params.type ?? null);
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [includeLogs, setIncludeLogs] = useState(params.type ? logsDefaultFor(params.type) : false);
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [receiptId, setReceiptId] = useState<string | null>(null);

  const supportsLogs = type === Report.CRASH || type === Report.BUG;

  const selectType = useCallback((next: ReportType) => {
    setType(next);
    setIncludeLogs(logsDefaultFor(next));
  }, []);

  const entering = useMemo(
    () => (reduceMotion ? undefined : FadeInDown.duration(350)),
    [reduceMotion]
  );

  const onSend = useCallback(async () => {
    if (!type) return;
    setStatus("submitting");
    try {
      const attachments =
        supportsLogs && includeLogs
          ? [await buildLogAttachment({ category: type, description: message.trim() || undefined })]
          : [];
      const receipt = await submitFeedback({ type, message, contact, attachments });
      setReceiptId(receipt.id);
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }, [type, supportsLogs, includeLogs, message, contact]);

  if (status === "success") {
    return (
      <Background>
        <TopBar title={t("feedback.title")} href="/settings" backOnClick />
        <VStack flex={1} padding="$4" gap="$4" justifyContent="center" alignItems="center">
          <VStack
            width={56}
            height={56}
            borderRadius={28}
            backgroundColor="$backgroundMuted"
            alignItems="center"
            justifyContent="center">
            <Icon as={Check} size={28} color="$accentPrimary" />
          </VStack>
          <Text size="lg" fontWeight="700" color="$typography" textAlign="center">
            {t("feedback.success.title")}
          </Text>
          <Text size="sm" color="$typographySecondary" textAlign="center" lineHeight={20}>
            {t("feedback.success.body")}
          </Text>
          {receiptId ? (
            <Text size="xs" color="$typographySecondary">
              {t("feedback.success.reference", { id: receiptId.slice(0, 8) })}
            </Text>
          ) : null}
          <Button
            variant="outline"
            width="100%"
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t("feedback.success.done")}>
            <Button.Text>{t("feedback.success.done")}</Button.Text>
          </Button>
        </VStack>
      </Background>
    );
  }

  return (
    <Background>
      <TopBar title={t("feedback.title")} href="/settings" backOnClick />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}>
        <Animated.View entering={entering}>
          <VStack padding="$4" gap="$4">
            <Text size="sm" color="$typographySecondary" lineHeight={20}>
              {t("feedback.intro")}
            </Text>

            {/* Type selector */}
            <VStack gap="$2">
              <Text size="sm" fontWeight="600" color="$typography">
                {t("feedback.typeLabel")}
              </Text>
              <HStack gap="$2" flexWrap="wrap">
                {TYPES.map(({ type: value, icon, labelKey }) => {
                  const selected = type === value;
                  return (
                    <Pressable
                      key={value}
                      onPress={() => selectType(value)}
                      flexBasis="48%"
                      flexGrow={1}
                      borderWidth={1}
                      borderColor={selected ? "$accentPrimary" : "$borderColor"}
                      backgroundColor={selected ? "$backgroundMuted" : "$backgroundSecondary"}
                      borderRadius="$4"
                      paddingVertical="$3"
                      paddingHorizontal="$3"
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      accessibilityLabel={t(labelKey)}>
                      <HStack gap="$2" alignItems="center">
                        <Icon
                          as={icon}
                          size={18}
                          color={selected ? "$accentPrimary" : "$typographySecondary"}
                        />
                        <Text
                          size="sm"
                          fontWeight={selected ? "600" : "400"}
                          color={selected ? "$accentPrimary" : "$typography"}>
                          {t(labelKey)}
                        </Text>
                      </HStack>
                    </Pressable>
                  );
                })}
              </HStack>
            </VStack>

            {/* Message */}
            <VStack gap="$2">
              <Text size="sm" fontWeight="600" color="$typography">
                {t("feedback.messageLabel")}
              </Text>
              <Input
                value={message}
                onChangeText={setMessage}
                placeholder={t("feedback.messagePlaceholder")}
                multiline
                numberOfLines={5}
                minHeight={110}
                paddingTop="$2"
                textAlignVertical="top"
                maxLength={4000}
                accessibilityLabel={t("feedback.messageLabel")}
              />
            </VStack>

            {/* Diagnostics toggle (crash/bug only) */}
            {supportsLogs ? (
              <Card padding="$3" backgroundColor="$backgroundSecondary">
                <HStack alignItems="center" justifyContent="space-between" gap="$3">
                  <HStack gap="$2" alignItems="center" flexShrink={1}>
                    <Icon as={FileText} size={18} color="$typographySecondary" />
                    <VStack flexShrink={1}>
                      <Text size="sm" fontWeight="600" color="$typography">
                        {t("feedback.logs.title")}
                      </Text>
                      <Text size="xs" color="$typographySecondary" lineHeight={16}>
                        {t("feedback.logs.subtitle")}
                      </Text>
                    </VStack>
                  </HStack>
                  <Switch
                    value={includeLogs}
                    onValueChange={setIncludeLogs}
                    accessibilityLabel={t("feedback.logs.title")}
                  />
                </HStack>
              </Card>
            ) : null}

            {/* Optional contact */}
            <VStack gap="$2">
              <Text size="sm" fontWeight="600" color="$typography">
                {t("feedback.contactLabel")}
              </Text>
              <Input
                value={contact}
                onChangeText={setContact}
                placeholder={t("feedback.contactPlaceholder")}
                autoCapitalize="none"
                keyboardType="email-address"
                maxLength={256}
                accessibilityLabel={t("feedback.contactLabel")}
              />
              <Text size="xs" color="$typographySecondary">
                {t("feedback.contactHint")}
              </Text>
            </VStack>

            {status === "error" ? (
              <Text size="sm" color="$error" textAlign="center">
                {t("feedback.error")}
              </Text>
            ) : null}

            <Button
              variant="outline"
              width="100%"
              disabled={!type || status === "submitting"}
              opacity={!type ? 0.5 : 1}
              onPress={onSend}
              accessibilityRole="button"
              accessibilityLabel={t("feedback.send")}>
              {status === "submitting" ? (
                <Spinner color="$accentPrimary" />
              ) : (
                <Button.Text>{t("feedback.send")}</Button.Text>
              )}
            </Button>
          </VStack>
        </Animated.View>
      </ScrollView>
    </Background>
  );
};

export default FeedbackScreen;
