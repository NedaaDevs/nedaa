import { usePreferencesStore } from "@/stores/preferences";
import { MushafVersion } from "@/enums/quran";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

const REFIRE_MS = 30 * 60 * 1000;
const lastFired = new Map<string, number>();

// Best-effort download ping, fire-and-forget by contract: never awaited, never
// retried, never user-visible. A dropped event is fine; a disturbed install is not.
// Dev builds don't send so testing never pollutes production stats.
export const trackDownload = (version: MushafVersion): void => {
  try {
    if (__DEV__ || !API_URL) return;
    if (!usePreferencesStore.getState().shareUsageStats) return;
    const now = Date.now();
    const last = lastFired.get(version);
    if (last !== undefined && now - last < REFIRE_MS) return;
    lastFired.set(version, now);
    fetch(`${API_URL}/quran/downloads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version }),
    }).catch(() => {});
  } catch {
    // stats must never affect downloads
  }
};
