import { act, renderHook } from "@testing-library/react-native";

import { QADA_ENTRY_STATUS, QADA_ENTRY_TYPE } from "@/constants/Qada";
import { useRecordDay } from "@/hooks/useRecordDay";
import { QadaDB, type QadaHistory } from "@/services/qada-db";
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
/** The ledger id the record's write returns. */
const RECORDED_ID = 5;

/** A record that saves: the store counts its one write. */
const saves = jest.fn(async (): Promise<number | null> => {
  useQadaStore.setState(({ writes }) => ({ writes: writes + 1 }));
  return RECORDED_ID;
});

const recordedDay = async (restoreDay: (id: number) => Promise<boolean>) => {
  const onFailed = jest.fn();
  useQadaStore.setState({
    pendingEntries: [FIRST],
    history: [FIRST],
    completeEntry: saves,
    restoreDay,
    writes: 0,
  });
  const { result } = await renderHook(() => useRecordDay(onFailed));
  await act(() => result.current.record());
  return { result, onFailed };
};

describe("useRecordDay", () => {
  afterEach(() => jest.restoreAllMocks());

  it("records off the batches the store holds when the tap runs", async () => {
    const completeEntry = jest.fn(async (): Promise<number | null> => null);
    useQadaStore.setState({ pendingEntries: [FIRST], history: [FIRST], completeEntry, writes: 0 });
    const { result } = await renderHook(() => useRecordDay(jest.fn()));
    const record = result.current.record;

    // A write closed FIRST after this render; no new render has run yet.
    useQadaStore.setState({ pendingEntries: [NEXT], history: [NEXT] });
    await act(() => record());

    expect(completeEntry).toHaveBeenCalledWith(NEXT.id);
  });

  it("reports a day that was not recorded", async () => {
    const onFailed = jest.fn();
    const completeEntry = jest.fn(async (): Promise<number | null> => null);
    useQadaStore.setState({ pendingEntries: [FIRST], history: [FIRST], completeEntry, writes: 0 });
    const { result } = await renderHook(() => useRecordDay(onFailed));

    await act(() => result.current.record());

    expect(onFailed).toHaveBeenCalledTimes(1);
    expect(result.current.last).toBeNull();
  });

  it("reports nothing when the day is recorded", async () => {
    const { result, onFailed } = await recordedDay(jest.fn(async () => true));

    expect(onFailed).not.toHaveBeenCalled();
    expect(result.current.last?.completionId).toBe(RECORDED_ID);
  });

  it("reports an undo that was not saved, and keeps Undo", async () => {
    jest.spyOn(QadaDB, "getNewestCompletionId").mockResolvedValue(RECORDED_ID);
    const { result, onFailed } = await recordedDay(jest.fn(async () => false));

    await act(() => result.current.undo());

    expect(onFailed).toHaveBeenCalledTimes(1);
    expect(result.current.last?.completionId).toBe(RECORDED_ID);
  });

  it("reports an undo whose newest day could not be read, and keeps Undo", async () => {
    jest.spyOn(QadaDB, "getNewestCompletionId").mockResolvedValue(null);
    const restoreDay = jest.fn(async () => true);
    const { result, onFailed } = await recordedDay(restoreDay);

    await act(() => result.current.undo());

    expect(onFailed).toHaveBeenCalledTimes(1);
    expect(restoreDay).not.toHaveBeenCalled();
    expect(result.current.last?.completionId).toBe(RECORDED_ID);
  });

  it("drops Undo without a report when a newer day was recorded elsewhere", async () => {
    jest.spyOn(QadaDB, "getNewestCompletionId").mockResolvedValue(RECORDED_ID + 1);
    const { result, onFailed } = await recordedDay(jest.fn(async () => true));

    await act(() => result.current.undo());

    expect(onFailed).not.toHaveBeenCalled();
    expect(result.current.last).toBeNull();
  });
});
