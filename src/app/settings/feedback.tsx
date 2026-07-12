import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, Image } from "react-native";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { router, useLocalSearchParams } from "expo-router";

import {
  AlertTriangle,
  Bug,
  Lightbulb,
  MessageCircle,
  FileText,
  Check,
  ChevronDown,
  ChevronUp,
  ImagePlus,
  X,
} from "lucide-react-native";

import { Background } from "@/components/ui/background";
import TopBar from "@/components/TopBar";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Pressable } from "@/components/ui/pressable";

import {
  submitFeedback,
  buildLogAttachment,
  pickImageAttachment,
  generateClientKey,
} from "@/services/feedback";
import { Report, type ReportType, type OutgoingAttachment } from "@/types/feedback";

type SubmitStatus = "idle" | "submitting" | "success" | "error";

const TYPES: { type: ReportType; icon: typeof Bug; labelKey: string }[] = [
  { type: Report.CRASH, icon: AlertTriangle, labelKey: "feedback.type.crash" },
  { type: Report.BUG, icon: Bug, labelKey: "feedback.type.bug" },
  { type: Report.FEATURE, icon: Lightbulb, labelKey: "feedback.type.feature" },
  { type: Report.OTHER, icon: MessageCircle, labelKey: "feedback.type.other" },
];

const AREAS = [
  "alarms",
  "prayer-times",
  "qibla",
  "athkar",
  "quran",
  "widgets",
  "umrah",
  "other",
] as const;

const AREA_KEY: Record<(typeof AREAS)[number], string> = {
  alarms: "feedback.area.alarms",
  "prayer-times": "feedback.area.prayerTimes",
  qibla: "feedback.area.qibla",
  athkar: "feedback.area.athkar",
  quran: "feedback.area.quran",
  widgets: "feedback.area.widgets",
  umrah: "feedback.area.umrah",
  other: "feedback.area.other",
};

const REPORT_VALUES = Object.values(Report) as string[];
const validType = (value?: string): ReportType | null =>
  value && REPORT_VALUES.includes(value) ? (value as ReportType) : null;

const logsDefaultFor = (type: ReportType): boolean => type === Report.CRASH || type === Report.BUG;

const formatBytes = (b: number): string => {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
};

const FeedbackScreen = () => {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const params = useLocalSearchParams<{ type?: string }>();
  const initialType = validType(params.type);

  const [type, setType] = useState<ReportType | null>(initialType);
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [area, setArea] = useState<string | undefined>(undefined);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const [logsRemoved, setLogsRemoved] = useState(false);
  const [logAttachment, setLogAttachment] = useState<OutgoingAttachment | null>(null);
  const [showLogPreview, setShowLogPreview] = useState(false);

  const [image, setImage] = useState<OutgoingAttachment | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [receiptId, setReceiptId] = useState<string | null>(null);

  const clientKey = useRef<string | null>(null);
  const supportsLogs = type === Report.CRASH || type === Report.BUG;
  const logsAttached = supportsLogs && !logsRemoved;

  // Prepare the log bundle in the background so its size is shown before Send.
  useEffect(() => {
    if (!logsAttached) return;
    let stale = false;
    buildLogAttachment({ category: type ?? "App" })
      .then((a) => {
        if (!stale) setLogAttachment(a);
      })
      .catch(() => {});
    return () => {
      stale = true;
    };
  }, [logsAttached, type]);

  // Any edit starts a fresh operation (new client key) and clears a prior error.
  const markEdited = useCallback(() => {
    clientKey.current = null;
    setStatus((s) => (s === "error" ? "idle" : s));
  }, []);

  const selectType = useCallback(
    (next: ReportType) => {
      setType(next);
      setLogsRemoved(!logsDefaultFor(next));
      markEdited();
    },
    [markEdited]
  );

  const onPickImage = useCallback(async () => {
    setImageError(null);
    const res = await pickImageAttachment();
    if (res.ok) {
      setImage(res.attachment);
      markEdited();
    } else if (res.reason === "tooLarge") {
      setImageError(t("feedback.image.tooLarge"));
    } else if (res.reason === "unsupported") {
      setImageError(t("feedback.image.unsupported"));
    }
  }, [markEdited, t]);

  const onSend = useCallback(async () => {
    if (!type) return;
    if (!clientKey.current) clientKey.current = generateClientKey();
    setStatus("submitting");
    setProgress(0);
    try {
      const attachments: OutgoingAttachment[] = [];
      if (logsAttached) {
        attachments.push(logAttachment ?? (await buildLogAttachment({ category: type })));
      }
      if (image) attachments.push(image);
      const receipt = await submitFeedback(
        { type, message, contact, area, attachments, clientKey: clientKey.current },
        setProgress
      );
      setReceiptId(receipt.id);
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }, [type, logsAttached, logAttachment, image, message, contact, area]);

  const enter = (i: number) => (reduceMotion ? undefined : FadeInDown.duration(320).delay(i * 55));

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
          <Text
            size="sm"
            color="$typographySecondary"
            textAlign="center"
            lineHeight={20}
            accessibilityLiveRegion="polite">
            {t("feedback.success.body")}
          </Text>
          {receiptId ? (
            <Text size="xs" color="$typographySecondary" selectable>
              {t("feedback.success.reference", { id: receiptId })}
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

  const submitting = status === "submitting";

  return (
    <Background>
      <TopBar title={t("feedback.title")} href="/settings" backOnClick />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}>
        <VStack padding="$4" gap="$5">
          <Animated.View entering={enter(0)}>
            <Text size="sm" color="$typographySecondary" lineHeight={20}>
              {t("feedback.intro")}
            </Text>
          </Animated.View>

          {/* Type */}
          <Animated.View entering={enter(1)}>
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
                      disabled={submitting}
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
          </Animated.View>

          {/* Message */}
          <Animated.View entering={enter(2)}>
            <VStack gap="$2">
              <Text size="sm" fontWeight="600" color="$typography">
                {t("feedback.messageLabel")}
              </Text>
              <Input
                value={message}
                onChangeText={(v) => {
                  setMessage(v);
                  markEdited();
                }}
                placeholder={t(
                  type ? `feedback.messagePlaceholder.${type}` : "feedback.messagePlaceholder"
                )}
                multiline
                size="$4"
                minHeight={120}
                paddingTop="$3"
                fontSize={16}
                textAlignVertical="top"
                maxLength={4000}
                accessibilityLabel={t("feedback.messageLabel")}
              />
            </VStack>
          </Animated.View>

          {/* Diagnostics (crash/bug) */}
          {supportsLogs ? (
            <Animated.View entering={enter(3)}>
              <Card padding="$3" backgroundColor="$backgroundSecondary">
                <VStack gap="$2">
                  <HStack alignItems="center" justifyContent="space-between" gap="$3">
                    <HStack gap="$2" alignItems="center" flexShrink={1}>
                      <Icon as={FileText} size={18} color="$typographySecondary" />
                      <VStack flexShrink={1}>
                        <Text size="sm" fontWeight="600" color="$typography">
                          {logsAttached ? t("feedback.logs.attached") : t("feedback.logs.title")}
                        </Text>
                        <Text size="xs" color="$typographySecondary" lineHeight={16}>
                          {logsAttached && logAttachment
                            ? formatBytes(logAttachment.bytes)
                            : t("feedback.logs.subtitle")}
                        </Text>
                      </VStack>
                    </HStack>
                    {logsAttached ? (
                      <Pressable
                        onPress={() => {
                          setLogsRemoved(true);
                          setShowLogPreview(false);
                          markEdited();
                        }}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={t("feedback.logs.remove")}>
                        <Text size="sm" color="$accentPrimary">
                          {t("feedback.logs.remove")}
                        </Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        onPress={() => {
                          setLogsRemoved(false);
                          markEdited();
                        }}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={t("feedback.logs.addBack")}>
                        <Text size="sm" color="$accentPrimary">
                          {t("feedback.logs.addBack")}
                        </Text>
                      </Pressable>
                    )}
                  </HStack>

                  {logsAttached && logAttachment && typeof logAttachment.body === "string" ? (
                    <>
                      <Pressable
                        onPress={() => setShowLogPreview((v) => !v)}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel={t("feedback.logs.preview")}>
                        <Text size="xs" color="$accentPrimary">
                          {showLogPreview
                            ? t("feedback.logs.hidePreview")
                            : t("feedback.logs.preview")}
                        </Text>
                      </Pressable>
                      {showLogPreview ? (
                        <ScrollView
                          style={{ maxHeight: 200 }}
                          nestedScrollEnabled
                          showsVerticalScrollIndicator>
                          <Text size="xs" color="$typographySecondary">
                            {logAttachment.body.slice(0, 8000)}
                          </Text>
                        </ScrollView>
                      ) : null}
                    </>
                  ) : null}
                </VStack>
              </Card>
            </Animated.View>
          ) : null}

          {/* Contact */}
          <Animated.View entering={enter(4)}>
            <VStack gap="$2">
              <Text size="sm" fontWeight="600" color="$typography">
                {t("feedback.contactLabel")}
              </Text>
              <Input
                value={contact}
                onChangeText={(v) => {
                  setContact(v);
                  markEdited();
                }}
                placeholder={t("feedback.contactPlaceholder")}
                autoCapitalize="none"
                keyboardType="email-address"
                size="$4"
                height={48}
                fontSize={16}
                maxLength={256}
                accessibilityLabel={t("feedback.contactLabel")}
              />
              <Text size="xs" color="$typographySecondary">
                {t("feedback.contactHint")}
              </Text>
            </VStack>
          </Animated.View>

          {/* Add details disclosure */}
          <Animated.View entering={enter(5)}>
            <VStack gap="$3">
              <Pressable
                onPress={() => setDetailsOpen((v) => !v)}
                minHeight={44}
                accessibilityRole="button"
                accessibilityState={{ expanded: detailsOpen }}
                accessibilityLabel={t(
                  detailsOpen ? "feedback.details.hide" : "feedback.details.show"
                )}>
                <HStack alignItems="center" gap="$2">
                  <Icon
                    as={detailsOpen ? ChevronUp : ChevronDown}
                    size={18}
                    color="$accentPrimary"
                  />
                  <Text size="sm" fontWeight="600" color="$accentPrimary">
                    {t(detailsOpen ? "feedback.details.hide" : "feedback.details.show")}
                  </Text>
                </HStack>
              </Pressable>

              {detailsOpen ? (
                <VStack gap="$4">
                  {/* Area */}
                  <VStack gap="$2">
                    <Text size="sm" fontWeight="600" color="$typography">
                      {t("feedback.area.label")}
                    </Text>
                    <HStack gap="$2" flexWrap="wrap">
                      {AREAS.map((value) => {
                        const selected = area === value;
                        return (
                          <Pressable
                            key={value}
                            onPress={() => {
                              setArea(selected ? undefined : value);
                              markEdited();
                            }}
                            disabled={submitting}
                            borderWidth={1}
                            borderColor={selected ? "$accentPrimary" : "$borderColor"}
                            backgroundColor={selected ? "$backgroundMuted" : "$backgroundSecondary"}
                            borderRadius="$10"
                            paddingVertical="$2"
                            paddingHorizontal="$3"
                            accessibilityRole="radio"
                            accessibilityState={{ selected }}
                            accessibilityLabel={t(AREA_KEY[value])}>
                            <Text
                              size="sm"
                              color={selected ? "$accentPrimary" : "$typography"}
                              fontWeight={selected ? "600" : "400"}>
                              {t(AREA_KEY[value])}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </HStack>
                  </VStack>

                  {/* Image */}
                  <VStack gap="$2">
                    <Text size="sm" fontWeight="600" color="$typography">
                      {t("feedback.image.label")}
                    </Text>
                    {image ? (
                      <HStack gap="$3" alignItems="center">
                        <Image
                          source={{ uri: (image.body as { uri: string }).uri }}
                          style={{ width: 56, height: 56, borderRadius: 8 }}
                        />
                        <Text size="xs" color="$typographySecondary" flexShrink={1}>
                          {formatBytes(image.bytes)}
                        </Text>
                        <Pressable
                          onPress={() => {
                            setImage(null);
                            markEdited();
                          }}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel={t("feedback.image.remove")}>
                          <Icon as={X} size={18} color="$typographySecondary" />
                        </Pressable>
                      </HStack>
                    ) : (
                      <Pressable
                        onPress={onPickImage}
                        disabled={submitting}
                        borderWidth={1}
                        borderColor="$borderColor"
                        backgroundColor="$backgroundSecondary"
                        borderRadius="$4"
                        paddingVertical="$3"
                        paddingHorizontal="$3"
                        accessibilityRole="button"
                        accessibilityLabel={t("feedback.image.add")}>
                        <HStack gap="$2" alignItems="center">
                          <Icon as={ImagePlus} size={18} color="$typographySecondary" />
                          <Text size="sm" color="$typography">
                            {t("feedback.image.add")}
                          </Text>
                        </HStack>
                      </Pressable>
                    )}
                    {imageError ? (
                      <Text size="xs" color="$error" accessibilityLiveRegion="polite">
                        {imageError}
                      </Text>
                    ) : null}
                  </VStack>
                </VStack>
              ) : null}
            </VStack>
          </Animated.View>

          {/* Submit — the button itself becomes the progress indicator while sending. */}
          <Animated.View entering={enter(6)}>
            <VStack gap="$3">
              {status === "error" ? (
                <Text
                  size="sm"
                  color="$error"
                  textAlign="center"
                  accessibilityLiveRegion="assertive">
                  {t("feedback.error")}
                </Text>
              ) : null}

              <Button
                variant="outline"
                width="100%"
                position="relative"
                overflow="hidden"
                disabled={!type || submitting}
                opacity={!type ? 0.5 : 1}
                onPress={onSend}
                accessibilityRole="button"
                accessibilityLabel={t(status === "error" ? "feedback.retry" : "feedback.send")}>
                {submitting ? (
                  <>
                    <Box
                      position="absolute"
                      left={0}
                      top={0}
                      bottom={0}
                      width={`${Math.round(progress * 100)}%`}
                      backgroundColor="$accentPrimary"
                      opacity={0.18}
                    />
                    <Button.Text>{t("feedback.sending")}</Button.Text>
                  </>
                ) : (
                  <Button.Text>
                    {t(status === "error" ? "feedback.retry" : "feedback.send")}
                  </Button.Text>
                )}
              </Button>
            </VStack>
          </Animated.View>
        </VStack>
      </ScrollView>
    </Background>
  );
};

export default FeedbackScreen;
