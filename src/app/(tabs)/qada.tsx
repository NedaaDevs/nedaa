import { useEffect, useRef, useState } from "react";
import type { ViewInstance } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Check, Settings } from "lucide-react-native";

import { AddBatchSheet } from "@/components/Qada/AddBatchSheet";
import { MessageToast } from "@/components/feedback/MessageToast";
import { Button } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { Icon } from "@/components/ui/icon";
import { ListGroup } from "@/components/ui/list-group";
import { LIST_ROW_VARIANT, ListRow } from "@/components/ui/list-row";
import { SpokenStatus } from "@/components/ui/live-region";
import { ScreenContent } from "@/components/ui/screen-content";
import { ScreenHeader } from "@/components/ui/screen-header";
import { ScreenSky, SkyOccluder, SkyScrollView } from "@/components/ui/sky-background";
import { StatePanel } from "@/components/ui/state-panel";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { PLURAL_DUAL } from "@/constants/Locales";
import { HAPTIC_FEEDBACK } from "@/constants/Haptics";
import { QADA_ENTRY_STATUS } from "@/constants/Qada";
import { useBatchText } from "@/hooks/useBatchText";
import { useHaptic } from "@/hooks/useHaptic";
import { useCountText } from "@/hooks/useRatioText";
import { useRecordDay } from "@/hooks/useRecordDay";
import { useTabBarInset } from "@/hooks/useTabBarInset";
import { useScreenshotSeed } from "@/screenshot-mode/useScreenshotSeed";
import { useAppStore } from "@/stores/app";
import { useQadaStore } from "@/stores/qada";
import { focusOn } from "@/utils/accessibilityFocus";

/** The remaining days, drawn larger than any type size. */
const HERO_FIGURE = 96;
/** The smallest the figure shrinks to so a long count fits the width. */
const HERO_FIGURE_MIN_SCALE = 0.5;

/** The days remaining, the way to the batches, and the record button. */
const Qada = () => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const tabBarInset = useTabBarInset();
  const router = useRouter();
  const countText = useCountText();
  const batchText = useBatchText();
  const remaining = useQadaStore((s) => s.totalMissed);
  const completed = useQadaStore((s) => s.totalCompleted);
  const total = useQadaStore((s) => s.totalOriginal);
  const history = useQadaStore((s) => s.history);
  const pendingEntries = useQadaStore((s) => s.pendingEntries);
  const loaded = useQadaStore((s) => s.loaded);
  // An error after the batches loaded belongs to a later write, not to the read.
  const loadFailed = useQadaStore((s) => !s.loaded && s.hasError);
  const loadData = useQadaStore((s) => s.loadData);
  const seedScreenshotState = useQadaStore((s) => s.seedScreenshotState);
  const locale = useAppStore((s) => s.locale);
  const { last, returned, record, undo } = useRecordDay(() =>
    MessageToast.showError(t("qada.saveFailed"))
  );
  const recordButton = useRef<ViewInstance>(null);
  const [adding, setAdding] = useState(false);
  const selection = useHaptic(HAPTIC_FEEDBACK.SELECTION);
  const light = useHaptic(HAPTIC_FEEDBACK.LIGHT);

  // The store is empty in screenshot mode, so the seed draws a populated home.
  const screenshotSeed = useScreenshotSeed("qada");
  useEffect(() => {
    if (screenshotSeed) return seedScreenshotState(screenshotSeed);
    // Launch setup reads the batches after its network work, or not at all if it fails.
    const store = useQadaStore.getState();
    if (!store.loaded) void store.loadData();
  }, [screenshotSeed, seedScreenshotState]);

  const hasBatches =
    pendingEntries.length > 0 || history.some(({ status }) => status !== QADA_ENTRY_STATUS.DELETED);
  const done = hasBatches && remaining === 0;
  const recordedText = last ? batchText(last.batch) : null;
  // A numeral before the Arabic dual is wrong, so two days is the dual alone.
  const dual = new Intl.PluralRules(locale).select(remaining) === PLURAL_DUAL;

  // Undo unmounts under the reader's focus; focus goes to the record button.
  useEffect(() => {
    if (returned) focusOn(recordButton.current);
  }, [returned]);

  const onRecord = async () => {
    await selection();
    await record();
  };
  const onUndo = async () => {
    await light();
    await undo();
  };
  const openBatches = () => router.push(BACK_DESTINATION.QADA_BATCHES.href);
  const downTitle = t(done ? "qada.batches.title" : "qada.home.batches");

  return (
    // The sky runs under both bars; the content scrolls clear of the tab bar.
    <ScreenSky>
      <SkyScrollView
        contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top, paddingBottom: tabBarInset }}>
        <SkyOccluder>
          <ScreenHeader
            title={t("qada.home.title")}
            back={{ to: BACK_DESTINATION.TOOLS }}
            action={{
              icon: Settings,
              label: t("a11y.qada.settings"),
              onPress: () => router.push(BACK_DESTINATION.SETTINGS_QADA.href),
            }}
          />
        </SkyOccluder>

        <ScreenContent flex={1} paddingTop="$4" paddingBottom="$5" gap="$section">
          <SkyOccluder>
            {/* The batches are not persisted; before they load, no state is known. */}
            {loadFailed ? (
              <StatePanel
                title={t("qada.home.loadFailed.title")}
                body={t("qada.home.loadFailed.body")}
                action={{ label: t("common.retry"), onPress: () => void loadData() }}
              />
            ) : !loaded ? null : !hasBatches ? (
              <Text size="heading" fontWeight="600" typography="display" color="$fg">
                {t("qada.home.emptyTitle")}
              </Text>
            ) : (
              <VStack gap="$1.5">
                {done ? (
                  <Text size="heading" fontWeight="600" typography="display" color="$fg">
                    {t("qada.home.doneTitle")}
                  </Text>
                ) : (
                  <VStack
                    accessible
                    accessibilityLabel={t("a11y.join", {
                      first: t("qada.home.remainingLabel"),
                      second: t("qada.days", { count: remaining }),
                    })}>
                    <Text size="label" fontWeight="500" color="$mutedSky">
                      {t("qada.home.remainingLabel")}
                    </Text>
                    <HStack alignItems="baseline" gap="$2">
                      {dual ? null : (
                        <Text
                          fontSize={HERO_FIGURE}
                          fontWeight="600"
                          typography="display"
                          color="$fg"
                          numeric
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={HERO_FIGURE_MIN_SCALE}
                          flexShrink={1}>
                          {countText(remaining)}
                        </Text>
                      )}
                      <Text size="headline" fontWeight="500" color="$fg" flexShrink={0}>
                        {t("qada.home.remainingUnit", { count: remaining })}
                      </Text>
                    </HStack>
                  </VStack>
                )}
                {completed > 0 ? (
                  <Text size="label" fontWeight="500" color="$mutedSky" numeric>
                    {t("qada.home.completedOf", { count: total, completed })}
                  </Text>
                ) : null}
              </VStack>
            )}
          </SkyOccluder>

          <VStack flex={1} />

          {hasBatches ? (
            <ListGroup>
              <ListRow
                variant={LIST_ROW_VARIANT.GROUPED}
                title={downTitle}
                value={pendingEntries.length > 0 ? countText(pendingEntries.length) : undefined}
                hint={t("a11y.opens", { name: downTitle })}
                onPress={openBatches}
              />
            </ListGroup>
          ) : null}

          <VStack gap="$2">
            <SkyOccluder>
              <HStack minHeight="$14" alignItems="center" gap="$2">
                {recordedText ? (
                  <>
                    <Icon as={Check} size="sm" color="$accentText" />
                    <Text size="label" fontWeight="500" color="$fg" numberOfLines={1} flex={1}>
                      {recordedText.name}
                    </Text>
                    <Text size="label" fontWeight="500" color="$muted" numeric>
                      {recordedText.left}
                    </Text>
                    <Button
                      variant="link"
                      accessibilityLabel={t("athkar.session.undo")}
                      accessibilityHint={t("a11y.qada.returnDaysHint", { count: 1 })}
                      onPress={onUndo}>
                      <Button.Text>{t("athkar.session.undo")}</Button.Text>
                    </Button>
                  </>
                ) : null}
              </HStack>
            </SkyOccluder>
            <SpokenStatus
              message={
                recordedText
                  ? t("a11y.qada.recordedFrom", { name: recordedText.name })
                  : returned
                    ? t("a11y.qada.dayReturned")
                    : null
              }
            />
            {!loaded ? null : hasBatches && !done ? (
              <Button
                ref={recordButton}
                size="lg"
                borderRadius="$pill"
                accessibilityLabel={t("qada.home.record")}
                onPress={onRecord}>
                <Button.Text>{t("qada.home.record")}</Button.Text>
              </Button>
            ) : (
              <Button
                size="lg"
                variant={done ? "outline" : "solid"}
                borderRadius="$pill"
                accessibilityLabel={t("qada.home.addBatch")}
                onPress={() => setAdding(true)}>
                <Button.Text>{t("qada.home.addBatch")}</Button.Text>
              </Button>
            )}
          </VStack>
        </ScreenContent>
      </SkyScrollView>

      <AddBatchSheet open={adding} onClose={() => setAdding(false)} />
    </ScreenSky>
  );
};

export default Qada;
