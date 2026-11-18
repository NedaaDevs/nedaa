import { act, renderHook } from "@testing-library/react-native";

import { QADA_ENTRY_STATUS, QADA_ENTRY_TYPE } from "@/constants/Qada";
import { useRecordDay } from "@/hooks/useRecordDay";
import type { QadaHistory } from "@/services/qada-db";
import { useQadaStore } from "@/stores/qada";

const batch = (id: number): QadaHistory => ({
  id,
  count: 2,
  type: QADA_ENTRY_TYPE.ADDED,
  status: QADA_ENTRY_STATUS.PENDING,
  created_at: "2026-11-01T09:00:00.000Z",
  updated_at: "2026-11-01T09:00:00.000Z",
});

const FIRST = batch(1);
const NEXT = batch(2);

describe("useRecordDay", () => {
  it("records off the batches the store holds when the tap runs", async () => {
    const completeEntry = jest.fn(async (): Promise<number | null> => null);
    useQadaStore.setState({ pendingEntries: [FIRST], history: [FIRST], completeEntry, writes: 0 });
    const { result } = await renderHook(() => useRecordDay());
    const record = result.current.record;

    // A write closed FIRST after this render; no new render has run yet.
    useQadaStore.setState({ pendingEntries: [NEXT], history: [NEXT] });
    await act(() => record());

    expect(completeEntry).toHaveBeenCalledWith(NEXT.id);
  });
});
