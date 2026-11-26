import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Plus } from "lucide-react-native";

import { MessageToast } from "@/components/feedback/MessageToast";
import { AddBatchSheet } from "@/components/Qada/AddBatchSheet";
import { BatchActionsSheet } from "@/components/Qada/BatchActionsSheet";
import { HStack } from "@/components/ui/hstack";
import { ListGroup } from "@/components/ui/list-group";
import { LIST_ROW_VARIANT, ListRow } from "@/components/ui/list-row";
import { ScreenContent } from "@/components/ui/screen-content";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Section } from "@/components/ui/section";
import { ScreenSky, SkyOccluder, SkyScrollView } from "@/components/ui/sky-background";
import { StatePanel } from "@/components/ui/state-panel";
import { SwipeToRemove } from "@/components/ui/swipe-to-remove";
import { Text } from "@/components/ui/text";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { HAPTIC_FEEDBACK } from "@/constants/Haptics";
import { QADA_ENTRY_STATUS } from "@/constants/Qada";
import { SECTION_KIND } from "@/constants/Section";
import { useBatchText } from "@/hooks/useBatchText";
import { useHaptic } from "@/hooks/useHaptic";
import { useQadaCompletions } from "@/hooks/useQadaCompletions";
import { useQadaDayText } from "@/hooks/useQadaDayText";
import type { QadaHistory } from "@/services/qada-db";
import { useQadaStore } from "@/stores/qada";

/** Every batch, oldest first, then the days recorded, newest first. */
const QadaBatches = () => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const batchText = useBatchText();
  const dayText = useQadaDayText();
  const history = useQadaStore((s) => s.history);
  const restoreDay = useQadaStore((s) => s.restoreDay);
  const { rows: completions, failed: historyFailed, retry: rereadHistory } = useQadaCompletions();
  const [acting, setActing] = useState<QadaHistory | null>(null);
  const [adding, setAdding] = useState(false);
  const light = useHaptic(HAPTIC_FEEDBACK.LIGHT);

  const batches = history.filter(({ status }) => status !== QADA_ENTRY_STATUS.DELETED).reverse();
  const unrecord = async (id: number) => {
    if (await restoreDay(id)) await light();
    else MessageToast.showError(t("qada.saveFailed"));
  };

  return (
    <ScreenSky>
      <SkyScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        }}>
        <SkyOccluder>
          <ScreenHeader
            title={t("qada.batches.title")}
            back={{ fallback: BACK_DESTINATION.QADA }}
          />
        </SkyOccluder>

        <SkyOccluder>
          <ScreenContent paddingTop="$2" paddingBottom="$8" gap="$section">
            <ListGroup>
              {batches.map((batch) => {
                const text = batchText(batch);
                return batch.status === QADA_ENTRY_STATUS.PENDING ? (
                  <ListRow
                    key={batch.id}
                    variant={LIST_ROW_VARIANT.GROUPED}
                    title={text.name}
                    status={text.added}
                    value={text.left}
                    hint={t("a11y.qada.batchActionsHint")}
                    onPress={() => setActing(batch)}
                  />
                ) : (
                  <ListRow
                    key={batch.id}
                    variant={LIST_ROW_VARIANT.GROUPED}
                    title={text.name}
                    status={t("a11y.join", { first: text.added, second: text.left })}
                    item
                  />
                );
              })}
              <ListRow
                key="add"
                variant={LIST_ROW_VARIANT.GROUPED}
                icon={Plus}
                title={t("qada.home.addBatch")}
                onPress={() => setAdding(true)}
              />
            </ListGroup>

            <Section title={t("qada.history.title")} kind={SECTION_KIND.LABEL}>
              {historyFailed ? (
                <StatePanel
                  title={t("qada.history.loadFailed.title")}
                  body={t("qada.history.loadFailed.body")}
                  action={{ label: t("common.retry"), onPress: rereadHistory }}
                />
              ) : completions === null ? null : completions.length === 0 ? (
                <Text size="label" color="$mutedSky">
                  {t("qada.noHistory")}
                </Text>
              ) : (
                <ListGroup>
                  {completions.map((day) => {
                    const date = dayText(day.created_at).text;
                    const count = day.count > 1 ? t("qada.days", { count: day.count }) : null;
                    return (
                      <SwipeToRemove
                        key={day.id}
                        label={t("qada.swipeDelete")}
                        rowLabel={count ? t("a11y.join", { first: date, second: count }) : date}
                        hint={t("a11y.qada.returnDaysHint", { count: day.count })}
                        onRemove={() => unrecord(day.id)}>
                        <HStack
                          minHeight="$14"
                          paddingHorizontal="$3.5"
                          alignItems="center"
                          gap="$2">
                          <Text size="lg" fontWeight="500" color="$fg" numeric flex={1}>
                            {date}
                          </Text>
                          {count ? (
                            <Text size="label" fontWeight="500" color="$muted" numeric>
                              {count}
                            </Text>
                          ) : null}
                        </HStack>
                      </SwipeToRemove>
                    );
                  })}
                </ListGroup>
              )}
            </Section>
          </ScreenContent>
        </SkyOccluder>
      </SkyScrollView>

      <BatchActionsSheet batch={acting} onClose={() => setActing(null)} />
      <AddBatchSheet open={adding} onClose={() => setAdding(false)} />
    </ScreenSky>
  );
};

export default QadaBatches;
