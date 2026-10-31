/** The date utils with a fixed Hijri day, for tests with no native module. */
module.exports = {
  ...jest.requireActual("@/utils/date"),
  HijriNative: {
    fromTimestamp: () => ({ year: 1448, month: 4, day: 12 }),
    addDays: (date: { day: number }, days: number) => ({ ...date, day: date.day + days }),
  },
};
