import { AppLogger } from "@/utils/appLogger";

const log = AppLogger.create("widgets");

export const POLL_INTERVAL_MS = 250;

// WidgetKit coalesces reloads and may defer a widget on a rarely-visited page
// until it becomes visible, so a short window would report pending on healthy
// systems. Android's cold path enqueues a WorkManager job before it composes.
export const CONFIRM_TIMEOUT_MS = 10_000;

export type WidgetRefreshResult = "confirmed" | "pending" | "none-placed" | "unavailable";

export type WidgetRefreshDeps = {
  isReloadAvailable: () => boolean;
  getPlacedWidgetCount: () => Promise<number>;
  getLastRenderedAt: () => number;
  reload: () => Promise<void>;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
};

/**
 * Requests a widget reload and waits for a widget to report that it rendered.
 * Neither platform has a render callback, so the heartbeat advancing is the only
 * evidence available; its absence is ambiguous and never means failure.
 */
export const refreshWidgets = async (deps: WidgetRefreshDeps): Promise<WidgetRefreshResult> => {
  if (!deps.isReloadAvailable()) return "unavailable";

  let placed: number | null = null;
  try {
    placed = await deps.getPlacedWidgetCount();
  } catch (error) {
    // An unreadable count is unknown, not zero — telling a user with widgets
    // that they have none is worse than skipping the check.
    log.w("Refresh", `placed widget count unavailable: ${String(error)}`);
  }
  let before = 0;
  try {
    before = deps.getLastRenderedAt();
    // Fired before the count is acted on: an under-reported count must not turn
    // the manual escape hatch into a no-op.
    await deps.reload();
  } catch (error) {
    log.e("Refresh", "widget reload failed", error as Error);
    return "unavailable";
  }

  if (placed === 0) return "none-placed";

  // Wall-clock deadline, not a tick count: JS timers freeze if the app backgrounds.
  const deadline = deps.now() + CONFIRM_TIMEOUT_MS;
  while (deps.now() < deadline) {
    await deps.sleep(POLL_INTERVAL_MS);
    let latest: number;
    try {
      latest = deps.getLastRenderedAt();
    } catch (error) {
      log.w("Refresh", `heartbeat unreadable: ${String(error)}`);
      return "pending";
    }
    // Not `>`: the device clock can move backwards between renders.
    if (latest !== before) return "confirmed";
  }

  return "pending";
};
