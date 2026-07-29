// Where a timing sits relative to the next one, so a row can be read at a glance.
export const TimingRowState = {
  DONE: "done",
  NEXT: "next",
  UPCOMING: "upcoming",
} as const;

// eslint-disable-next-line @typescript-eslint/no-redeclare -- value + type share one name (const-as-const idiom)
export type TimingRowState = (typeof TimingRowState)[keyof typeof TimingRowState];
