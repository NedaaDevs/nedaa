import { useEffect, useState } from "react";

import { QADA_HISTORY_LIMIT } from "@/constants/Qada";
import { QadaDB, type QadaHistory } from "@/services/qada-db";
import { useQadaStore } from "@/stores/qada";

type Completions = {
  /** Newest first; null until the first read lands. */
  rows: readonly QadaHistory[] | null;
  /** Whether the latest read failed; a later read that lands clears it. */
  failed: boolean;
  retry: () => void;
};

/** The recorded days, read again on each write and on retry. */
export const useQadaCompletions = (): Completions => {
  const totalMissed = useQadaStore((s) => s.totalMissed);
  const totalCompleted = useQadaStore((s) => s.totalCompleted);
  // A write can leave the totals as they were, so it rereads on its own.
  const writes = useQadaStore((s) => s.writes);
  const [rows, setRows] = useState<readonly QadaHistory[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    QadaDB.getCompletions(QADA_HISTORY_LIMIT).then(
      (next) => {
        if (!live) return;
        setRows(next);
        setFailed(false);
      },
      () => {
        if (live) setFailed(true);
      }
    );
    return () => {
      live = false;
    };
  }, [totalMissed, totalCompleted, writes, attempt]);

  return { rows, failed, retry: () => setAttempt((n) => n + 1) };
};
