import { QADA_ENTRY_STATUS, QADA_ENTRY_TYPE } from "@/constants/Qada";
import type { QadaHistory } from "@/services/qada-db";
import { dayLabelOf, oldestOpenBatch } from "@/utils/qadaDays";

const batch = (id: number, created_at: string, overrides: Partial<QadaHistory> = {}) => ({
  id,
  count: 2,
  type: QADA_ENTRY_TYPE.ADDED,
  status: QADA_ENTRY_STATUS.PENDING,
  notes: null,
  created_at,
  updated_at: created_at,
  ...overrides,
});

describe("oldestOpenBatch", () => {
  it("takes the batch added first", () => {
    const entries = [
      batch(3, "2026-11-10T08:00:00.000Z"),
      batch(1, "2026-09-01T08:00:00.000Z"),
      batch(2, "2026-10-01T08:00:00.000Z"),
    ];

    expect(oldestOpenBatch(entries)?.id).toBe(1);
  });

  it("breaks a tie on the order the batches were written", () => {
    const same = "2026-11-10T08:00:00.000Z";

    expect(oldestOpenBatch([batch(9, same), batch(4, same)])?.id).toBe(4);
  });

  it("skips batches with no days left", () => {
    const entries = [
      batch(1, "2026-09-01T08:00:00.000Z", { status: QADA_ENTRY_STATUS.COMPLETED }),
      batch(2, "2026-10-01T08:00:00.000Z"),
    ];

    expect(oldestOpenBatch(entries)?.id).toBe(2);
  });

  it("finds none when nothing is open", () => {
    expect(oldestOpenBatch([])).toBeUndefined();
  });
});

describe("dayLabelOf", () => {
  const today = { year: 1448, month: 5, day: 27 };

  it("calls today's date today", () => {
    expect(dayLabelOf({ ...today }, today)).toEqual({ today: true });
  });

  it("leaves the year off a date in this year", () => {
    expect(dayLabelOf({ year: 1448, month: 2, day: 25 }, today)).toEqual({
      today: false,
      day: 25,
      month: 2,
    });
  });

  it("names the year of a date in another year", () => {
    expect(dayLabelOf({ year: 1447, month: 12, day: 3 }, today)).toEqual({
      today: false,
      day: 3,
      month: 12,
      year: 1447,
    });
  });
});
