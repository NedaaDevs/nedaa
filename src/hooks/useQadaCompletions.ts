import { useEffect, useState } from "react";

import { QADA_HISTORY_LIMIT } from "@/constants/Qada";
import { QadaDB, type QadaHistory } from "@/services/qada-db";
import { useQadaStore } from "@/stores/qada";

/** The recorded days, newest first, read again whenever the totals move. */
export const useQadaCompletions = (): readonly QadaHistory[] => {
  const totalMissed = useQadaStore((s) => s.totalMissed);
  const totalCompleted = useQadaStore((s) => s.totalCompleted);
  const [rows, setRows] = useState<readonly QadaHistory[]>([]);

  useEffect(() => {
    let live = true;
    void QadaDB.getCompletions(QADA_HISTORY_LIMIT).then((next) => {
      if (live) setRows(next);
    });
    return () => {
      live = false;
    };
  }, [totalMissed, totalCompleted]);

  return rows;
};
