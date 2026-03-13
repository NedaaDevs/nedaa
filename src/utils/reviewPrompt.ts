import * as StoreReview from "expo-store-review";
import * as Application from "expo-application";
import Storage from "expo-sqlite/kv-store";

const SESSIONS_KEY = "review_app_sessions";
const LAST_VERSION_KEY = "review_last_version_prompted";
const REQUIRED_SESSIONS = 5;

export async function trackAppSession(): Promise<void> {
  try {
    const raw = await Storage.getItemAsync(SESSIONS_KEY);
    const count = (raw ? parseInt(raw, 10) : 0) + 1;
    await Storage.setItemAsync(SESSIONS_KEY, String(count));
  } catch {
    // Non-critical
  }
}

export async function promptReviewIfEligible(): Promise<void> {
  try {
    const hasAction = await StoreReview.hasAction();
    if (!hasAction) return;

    const raw = await Storage.getItemAsync(SESSIONS_KEY);
    const sessions = raw ? parseInt(raw, 10) : 0;
    if (sessions < REQUIRED_SESSIONS) return;

    const currentVersion = Application.nativeApplicationVersion ?? "unknown";
    const lastVersionPrompted = await Storage.getItemAsync(LAST_VERSION_KEY);
    if (currentVersion === lastVersionPrompted) return;

    await new Promise((resolve) => setTimeout(resolve, 2000));
    await StoreReview.requestReview();
    await Storage.setItemAsync(LAST_VERSION_KEY, currentVersion);
  } catch {
    // Non-critical
  }
}
