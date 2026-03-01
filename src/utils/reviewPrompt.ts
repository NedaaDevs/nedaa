import * as StoreReview from "expo-store-review";
import * as Application from "expo-application";
import Storage from "expo-sqlite/kv-store";

const SESSIONS_KEY = "review_app_sessions";
const LAST_VERSION_KEY = "review_last_version_prompted";
const REQUIRED_SESSIONS = 5;

export function trackAppSession(): void {
  try {
    const raw = Storage.getItemSync(SESSIONS_KEY);
    const count = (raw ? parseInt(raw, 10) : 0) + 1;
    Storage.setItemSync(SESSIONS_KEY, String(count));
  } catch {
    // Non-critical
  }
}

export async function promptReviewIfEligible(): Promise<void> {
  try {
    const hasAction = await StoreReview.hasAction();
    if (!hasAction) return;

    const raw = Storage.getItemSync(SESSIONS_KEY);
    const sessions = raw ? parseInt(raw, 10) : 0;
    if (sessions < REQUIRED_SESSIONS) return;

    const currentVersion = Application.nativeApplicationVersion ?? "unknown";
    const lastVersionPrompted = Storage.getItemSync(LAST_VERSION_KEY);
    if (currentVersion === lastVersionPrompted) return;

    await new Promise((resolve) => setTimeout(resolve, 2000));
    await StoreReview.requestReview();
    Storage.setItemSync(LAST_VERSION_KEY, currentVersion);
  } catch {
    // Non-critical
  }
}
