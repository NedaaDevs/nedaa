import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  Actionsheet,
  ActionsheetCloseButton,
  ActionsheetContent,
  ActionsheetTitle,
} from "@/components/ui/actionsheet";
import { Button } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HAPTIC_FEEDBACK } from "@/constants/Haptics";
import { useBatchText } from "@/hooks/useBatchText";
import { useHaptic } from "@/hooks/useHaptic";
import { useCountText } from "@/hooks/useRatioText";
import type { QadaHistory } from "@/services/qada-db";
import { useQadaStore } from "@/stores/qada";

/** The batch to act on; null closes the sheet. */
type Props = { batch: QadaHistory | null; onClose: () => void };

/** An open batch's actions: make up one day, all of them, or remove the batch. */
export const BatchActionsSheet = ({ batch, onClose }: Props) => {
  const { t } = useTranslation();
  const countText = useCountText();
  const batchText = useBatchText();
  const completeEntry = useQadaStore((s) => s.completeEntry);
  const completeSpecificEntry = useQadaStore((s) => s.completeSpecificEntry);
  const deleteEntry = useQadaStore((s) => s.deleteEntry);
  const success = useHaptic(HAPTIC_FEEDBACK.SUCCESS);
  const light = useHaptic(HAPTIC_FEEDBACK.LIGHT);
  // The closing sheet keeps showing the batch it was opened for.
  const [shown, setShown] = useState(batch);
  if (batch && batch !== shown) setShown(batch);

  const act =
    (write: (id: number) => Promise<boolean>, haptic: () => Promise<void>) => async () => {
      if (!batch) return;
      onClose();
      if (await write(batch.id)) await haptic();
    };

  const all = shown ? `${t("common.all")} (${countText(shown.count)})` : "";
  const text = shown ? batchText(shown) : null;

  return (
    <Actionsheet isOpen={batch !== null} onClose={onClose} fitContent>
      <ActionsheetContent>
        <VStack gap="$group">
          <HStack alignItems="center" justifyContent="space-between" gap="$stack">
            <ActionsheetTitle>
              <Text size="lg" bold typography="title" color="$fg">
                {text?.name}
              </Text>
              <Text size="helper" fontWeight="500" color="$muted">
                {text?.left}
              </Text>
            </ActionsheetTitle>
            <ActionsheetCloseButton onPress={onClose} />
          </HStack>
          <VStack gap="$inline">
            <Button
              size="lg"
              borderRadius="$pill"
              accessibilityLabel={t("common.complete")}
              accessibilityHint={t("a11y.qada.completeOneHint")}
              onPress={act(async (id) => (await completeEntry(id)) !== null, success)}>
              <Button.Text>{t("common.complete")}</Button.Text>
            </Button>
            {shown && shown.count > 1 ? (
              <Button
                size="lg"
                variant="outline"
                borderRadius="$pill"
                accessibilityLabel={all}
                accessibilityHint={t("a11y.qada.completeAllHint")}
                onPress={act(completeSpecificEntry, success)}>
                <Button.Text>{all}</Button.Text>
              </Button>
            ) : null}
            <Button
              size="lg"
              action="negative"
              variant="link"
              accessibilityLabel={t("common.delete")}
              accessibilityHint={t("a11y.qada.deleteHint")}
              onPress={act(deleteEntry, light)}>
              <Button.Text>{t("common.delete")}</Button.Text>
            </Button>
          </VStack>
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
};
