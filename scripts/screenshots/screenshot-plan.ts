export const SCREEN_KEYS = [
  "prayer-times",
  "reliable-alarms",
  "athkar",
  "qibla",
  "privacy",
  "qada",
  "quran",
  "athkar-with-audio",
  "tools",
  "umrah",
] as const;

export type ScreenKey = (typeof SCREEN_KEYS)[number];
export type TargetPlatform = "ios" | "android";
export type Variant = "hero" | "honest" | "athkar";

export type PlanCell = {
  idx: number;
  screen: ScreenKey;
  variant: Variant;
};

// Per-platform store order. Reliable alarms lead on Android (works for all
// users) but sit lower on iOS, where they need iOS 26.1+ and are footnoted.
// Quran sits high on both — it is the headline feature. Privacy closes as the
// text cell.
//
// The App Store takes 10 cells, so iOS carries all nine. Google Play caps at
// eight, so Android drops Qibla: of the cells the Tools grid already links to,
// it is the one users do not choose an app for — every competitor has a compass.
export const STORE_PLAN: Record<TargetPlatform, PlanCell[]> = {
  ios: [
    { idx: 1, screen: "prayer-times", variant: "hero" },
    { idx: 2, screen: "quran", variant: "hero" },
    { idx: 3, screen: "athkar-with-audio", variant: "hero" },
    { idx: 4, screen: "umrah", variant: "hero" },
    { idx: 5, screen: "qibla", variant: "hero" },
    { idx: 6, screen: "qada", variant: "hero" },
    { idx: 7, screen: "reliable-alarms", variant: "hero" },
    { idx: 8, screen: "tools", variant: "hero" },
    { idx: 9, screen: "privacy", variant: "honest" },
  ],
  android: [
    { idx: 1, screen: "prayer-times", variant: "hero" },
    { idx: 2, screen: "reliable-alarms", variant: "hero" },
    { idx: 3, screen: "quran", variant: "hero" },
    { idx: 4, screen: "athkar-with-audio", variant: "hero" },
    { idx: 5, screen: "umrah", variant: "hero" },
    { idx: 6, screen: "qada", variant: "hero" },
    { idx: 7, screen: "tools", variant: "hero" },
    { idx: 8, screen: "privacy", variant: "honest" },
  ],
};

export function fileStem(cell: Pick<PlanCell, "idx" | "screen">): string {
  return `${String(cell.idx).padStart(2, "0")}-${cell.screen}`;
}

// Throws if a plan's indices are not the contiguous run 1..N or a screen repeats
// — either would silently drop or collide a store slot.
export function validatePlan(cells: PlanCell[]): void {
  const indices = cells.map((c) => c.idx).sort((a, b) => a - b);
  indices.forEach((idx, i) => {
    if (idx !== i + 1) {
      throw new Error(`Plan indices must be contiguous 1..N; got ${indices.join(",")}`);
    }
  });
  const screens = new Set(cells.map((c) => c.screen));
  if (screens.size !== cells.length) {
    throw new Error(`Plan has duplicate screens: ${cells.map((c) => c.screen).join(",")}`);
  }
}

export function planFor(platform: TargetPlatform): PlanCell[] {
  const plan = STORE_PLAN[platform];
  validatePlan(plan);
  return plan;
}
