import { ScheduledAlarmType } from "@/enums/alarm";
import { generateDeterministicUUID, getAlarmKey, getLegacyAlarmKey } from "@/utils/alarmId";

// AlarmKit reads each id with UUID(uuidString:).
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const idOf = (key: string): string => generateDeterministicUUID(key);

describe("alarm ids", () => {
  it("gives two triggers on one UTC date their own ids", () => {
    const early = new Date("2026-10-27T00:00:00.000Z");
    const late = new Date("2026-10-27T23:59:00.000Z");

    const earlyKey = getAlarmKey(ScheduledAlarmType.FAJR, early);
    const lateKey = getAlarmKey(ScheduledAlarmType.FAJR, late);

    expect(earlyKey).not.toBe(lateKey);
    expect(idOf(earlyKey)).not.toBe(idOf(lateKey));
    expect(idOf(earlyKey)).toMatch(UUID_V4);
    expect(idOf(lateKey)).toMatch(UUID_V4);
  });

  it("keys one instant the same from any Date", () => {
    const fromUtc = new Date("2026-10-26T23:59:00.000Z");
    const fromOffset = new Date("2026-10-27T04:59:00.000+05:00");

    expect(getAlarmKey(ScheduledAlarmType.FAJR, fromOffset)).toBe(
      getAlarmKey(ScheduledAlarmType.FAJR, fromUtc)
    );
    expect(getAlarmKey(ScheduledAlarmType.FAJR, fromOffset)).toBe(
      `${ScheduledAlarmType.FAJR}_2026-10-26T23:59:00.000Z`
    );
  });

  it("never gives an instant key the id of a 2.x key", () => {
    // Both ends of a UTC date, the day Europe leaves summer time, a Friday.
    const triggers = [
      { at: "2026-10-27T00:00:00.000Z", date: "2026-10-27" },
      { at: "2026-10-27T23:59:00.000Z", date: "2026-10-27" },
      { at: "2026-10-25T01:30:00.000Z", date: "2026-10-25" },
      { at: "2026-10-30T08:55:00.000Z", date: "2026-10-30" },
    ];
    const types = [ScheduledAlarmType.FAJR, ScheduledAlarmType.JUMMAH];

    const instantIds = new Set<string>();
    const legacyIds = new Set<string>();
    for (const type of types) {
      for (const { at, date } of triggers) {
        const legacyKey = getLegacyAlarmKey(type, new Date(at));
        expect(legacyKey).toBe(`${type}_${date}`);
        legacyIds.add(idOf(legacyKey));
        instantIds.add(idOf(getAlarmKey(type, new Date(at))));
      }
    }

    expect(instantIds.size).toBe(types.length * triggers.length);
    expect([...instantIds].filter((id) => legacyIds.has(id))).toEqual([]);
  });
});
