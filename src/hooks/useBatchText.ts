import { useTranslation } from "react-i18next";

import { QADA_ENTRY_STATUS } from "@/constants/Qada";
import { useQadaDayText } from "@/hooks/useQadaDayText";
import type { QadaHistory } from "@/services/qada-db";

/** A batch's name, when it was added, and the days it has left. */
export const useBatchText = () => {
  const { t } = useTranslation();
  const dayText = useQadaDayText();

  return (batch: QadaHistory) => {
    const added = dayText(batch.created_at);
    return {
      name: batch.notes?.trim() || t("qada.batch.unnamed"),
      added: added.today
        ? t("qada.batch.addedToday")
        : t("qada.batch.addedOn", { date: added.text }),
      left:
        batch.status === QADA_ENTRY_STATUS.PENDING
          ? t("qada.days", { count: batch.count })
          : t("qada.batch.done"),
    };
  };
};
