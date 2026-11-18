import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Actionsheet, ActionsheetContent, ActionsheetTitle } from "@/components/ui/actionsheet";
import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { ListGroup } from "@/components/ui/list-group";
import { LIST_ROW_VARIANT, ListRow } from "@/components/ui/list-row";
import { Pressable } from "@/components/ui/pressable";
import { SheetInput } from "@/components/ui/sheet-input";
import { Stepper } from "@/components/ui/stepper";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HAPTIC_FEEDBACK } from "@/constants/Haptics";
import { QADA_BATCH_DAYS, QADA_QUICK_DAYS } from "@/constants/Qada";
import { useHaptic } from "@/hooks/useHaptic";
import { useSingleFlight } from "@/hooks/useSingleFlight";
import { useCountText } from "@/hooks/useRatioText";
import { useQadaStore } from "@/stores/qada";

/** Notes past this length are cut. */
const NOTE_MAX_LENGTH = 200;

type Props = { open: boolean; onClose: () => void };

/** A new batch of days owed: how many, and an optional note that names it. */
export const AddBatchSheet = ({ open, onClose }: Props) => {
  const { t } = useTranslation();
  const countText = useCountText();
  const addMissed = useQadaStore((s) => s.addMissed);
  const success = useHaptic(HAPTIC_FEEDBACK.SUCCESS);
  const selection = useHaptic(HAPTIC_FEEDBACK.SELECTION);
  const [days, setDays] = useState<number>(QADA_BATCH_DAYS.MIN);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  // The sheet takes taps while it slides away; one batch per opening.
  const [sent, setSent] = useState(false);
  const [shownOpen, setShownOpen] = useState(open);
  if (open !== shownOpen) {
    setShownOpen(open);
    if (open) setSent(false);
  }

  const close = () => {
    setDays(QADA_BATCH_DAYS.MIN);
    setNoteOpen(false);
    setNote("");
    onClose();
  };

  // A second tap while the write runs would add the batch twice.
  const run = useSingleFlight();
  const submit = () =>
    run(async () => {
      if (sent) return;
      if (await addMissed(days, note.trim() || undefined)) {
        setSent(true);
        await success();
        close();
      }
    });

  const daysText = t("qada.days", { count: days });

  return (
    <Actionsheet isOpen={open} onClose={close} fitContent>
      <ActionsheetContent>
        <VStack gap="$group">
          <HStack alignItems="center">
            <Box flex={1} alignItems="flex-start">
              <Button variant="link" onPress={close} accessibilityLabel={t("common.cancel")}>
                <Button.Text>{t("common.cancel")}</Button.Text>
              </Button>
            </Box>
            <ActionsheetTitle>
              <Text size="lg" bold typography="title" color="$fg">
                {t("qada.addBatch.title")}
              </Text>
            </ActionsheetTitle>
            <Box flex={1} />
          </HStack>

          <ListGroup>
            <VStack gap="$stack" paddingHorizontal="$3.5" paddingVertical="$stack">
              <Text size="label" fontWeight="500" color="$muted">
                {t("qada.addBatch.days")}
              </Text>
              <Stepper
                value={days}
                onChange={setDays}
                min={QADA_BATCH_DAYS.MIN}
                max={QADA_BATCH_DAYS.MAX}
                accessibilityLabel={t("qada.addBatch.days")}
                valueText={daysText}>
                <Text size="headline" fontWeight="600" color="$fg" numeric>
                  {countText(days)}
                </Text>
              </Stepper>
            </VStack>
            {noteOpen ? (
              <Box paddingHorizontal="$3.5" paddingVertical="$stack">
                <SheetInput
                  autoFocus
                  value={note}
                  onChangeText={setNote}
                  maxLength={NOTE_MAX_LENGTH}
                  placeholder={t("qada.notesPlaceholder")}
                  accessibilityLabel={t("qada.notes")}
                />
              </Box>
            ) : (
              <ListRow
                variant={LIST_ROW_VARIANT.GROUPED}
                title={t("qada.addBatch.note")}
                value={t("qada.addBatch.noteOptional")}
                onPress={() => setNoteOpen(true)}
              />
            )}
          </ListGroup>

          <HStack gap="$inline">
            {QADA_QUICK_DAYS.map((quick) => {
              const selected = quick === days;
              return (
                <Pressable
                  key={quick}
                  accessibilityRole="button"
                  accessibilityLabel={t("qada.days", { count: quick })}
                  accessibilityState={{ selected }}
                  onPress={() => {
                    void selection();
                    setDays(quick);
                  }}
                  flex={1}
                  alignItems="center"
                  justifyContent="center"
                  borderRadius="$pill"
                  backgroundColor={selected ? "$accentSoft" : "$surface2"}
                  borderWidth={1}
                  borderColor={selected ? "$accentEdge" : "$hairline"}>
                  <Text size="lg" fontWeight="600" color={selected ? "$accentText" : "$fg"} numeric>
                    {countText(quick)}
                  </Text>
                </Pressable>
              );
            })}
          </HStack>

          <Button
            size="lg"
            borderRadius="$pill"
            accessibilityLabel={t("qada.addBatch.submit")}
            onPress={submit}>
            <Button.Text>{t("qada.addBatch.submit")}</Button.Text>
          </Button>
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
};
