import { useState } from "react";

import { useSingleFlight } from "@/hooks/useSingleFlight";
import { QadaDB, type QadaHistory } from "@/services/qada-db";
import { useQadaStore } from "@/stores/qada";
import { oldestOpenBatch } from "@/utils/qadaDays";

/** A recorded day: its ledger row, its batch as the day left it, and the store's writes then. */
type RecordedDay = { completionId: number; batch: QadaHistory; writes: number };

/** Records one day off the oldest open batch, and undoes the last one recorded. */
export const useRecordDay = () => {
  const completeEntry = useQadaStore((s) => s.completeEntry);
  const restoreDay = useQadaStore((s) => s.restoreDay);
  const writes = useQadaStore((s) => s.writes);
  const [recorded, setRecorded] = useState<RecordedDay | null>(null);
  const [returnedAt, setReturnedAt] = useState<number | null>(null);
  // A second tap during a write would record off a stale batch.
  const run = useSingleFlight();

  const record = () =>
    run(async () => {
      // Read at run time, not render, so a late tap sees the last write's batches.
      const before = useQadaStore.getState();
      const batch = oldestOpenBatch(before.pendingEntries);
      if (!batch) return;
      const completionId = await completeEntry(batch.id);
      if (completionId === null) return;
      const state = useQadaStore.getState();
      // Only the record's own write may land; any other may have moved the day.
      if (state.writes > before.writes + 1) return;
      setRecorded({
        completionId,
        batch: state.history.find(({ id }) => id === batch.id) ?? batch,
        writes: state.writes,
      });
    });

  // Any other write, on this screen or another, may have moved the day.
  const last = recorded?.writes === writes ? recorded : null;
  const returned = returnedAt === writes;

  const undo = () =>
    run(async () => {
      if (!last) return;
      const newest = await QadaDB.getNewestCompletionId();
      // The recorded day still exists, so null is a failed read; Undo stays.
      if (newest === null) return;
      // Ids grow with each insert, so a newer id means a newer day.
      if (newest !== last.completionId) {
        setRecorded(null);
        return;
      }
      if (!(await restoreDay(last.completionId))) return;
      setRecorded(null);
      setReturnedAt(useQadaStore.getState().writes);
    });

  return { last, returned, record, undo };
};
