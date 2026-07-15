import { usePreferencesStore } from "@/stores/preferences";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

const REFIRE_MS = 30 * 60 * 1000;
const lastFired = new Map<string, number>();

// Best-effort play ping, fire-and-forget by contract: never awaited, never
// retried, never user-visible. A dropped event is fine; disturbed playback is not.
// Dev builds don't send so testing never pollutes production stats.
export const trackPlay = (recitationId: string): void => {
  try {
    if (__DEV__ || !API_URL) return;
    if (!usePreferencesStore.getState().shareUsageStats) return;
    const now = Date.now();
    const last = lastFired.get(recitationId);
    if (last !== undefined && now - last < REFIRE_MS) return;
    lastFired.set(recitationId, now);
    fetch(`${API_URL}/quran/plays`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recitationId }),
    }).catch(() => {});
  } catch {
    // stats must never affect playback
  }
};
