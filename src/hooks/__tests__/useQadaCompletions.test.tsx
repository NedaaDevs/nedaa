import { act, renderHook, waitFor } from "@testing-library/react-native";

import { QADA_ENTRY_STATUS, QADA_ENTRY_TYPE } from "@/constants/Qada";
import { useQadaCompletions } from "@/hooks/useQadaCompletions";
import { QadaDB, type QadaHistory } from "@/services/qada-db";
import { useQadaStore } from "@/stores/qada";

jest.mock("@/services/qada-db", () => {
  const actual = jest.requireActual("@/services/qada-db");
  return { ...actual, QadaDB: { ...actual.QadaDB, getCompletions: jest.fn() } };
});

const day = (id: number): QadaHistory => ({
  id,
  count: 1,
  type: QADA_ENTRY_TYPE.COMPLETED,
  status: QADA_ENTRY_STATUS.COMPLETED,
  created_at: "2026-11-01T09:00:00.000Z",
  updated_at: "2026-11-01T09:00:00.000Z",
});

describe("useQadaCompletions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useQadaStore.setState({ totalMissed: 3, totalCompleted: 1, writes: 0 });
  });

  it("is unread until the first read lands", async () => {
    jest.mocked(QadaDB.getCompletions).mockReturnValue(new Promise(() => {}));

    const { result } = await renderHook(() => useQadaCompletions());

    expect(result.current.rows).toBeNull();
    expect(result.current.failed).toBe(false);
  });

  it("reads again after a write that leaves the totals as they were", async () => {
    jest.mocked(QadaDB.getCompletions).mockResolvedValueOnce([day(1)]);
    const { result } = await renderHook(() => useQadaCompletions());
    await waitFor(() => expect(result.current.rows).toEqual([day(1)]));

    jest.mocked(QadaDB.getCompletions).mockResolvedValueOnce([day(2)]);
    await act(() => useQadaStore.setState((state) => ({ writes: state.writes + 1 })));

    await waitFor(() => expect(result.current.rows).toEqual([day(2)]));
    expect(QadaDB.getCompletions).toHaveBeenCalledTimes(2);
  });

  it("reports a failed read, and clears it when a retry reads", async () => {
    jest.mocked(QadaDB.getCompletions).mockRejectedValueOnce(new Error("read failed"));
    const { result } = await renderHook(() => useQadaCompletions());
    await waitFor(() => expect(result.current.failed).toBe(true));
    expect(result.current.rows).toBeNull();

    jest.mocked(QadaDB.getCompletions).mockResolvedValueOnce([]);
    await act(() => result.current.retry());

    await waitFor(() => expect(result.current.failed).toBe(false));
    expect(result.current.rows).toEqual([]);
  });
});
