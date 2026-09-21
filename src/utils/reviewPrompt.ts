import * as StoreReview from "expo-store-review";
import * as Application from "expo-application";
import Storage from "expo-sqlite/kv-store";

const SESSIONS_KEY = "review_app_sessions";
const SESSIONS_VERSION_KEY = "review_app_sessions_version";
const LAST_VERSION_KEY = "review_last_version_prompted";
const REQUIRED_SESSIONS = 5;

/**
 * Releases that never ask for a review, matched as a version prefix so "3."
 * covers the whole 3.x line. A rating given during a major interface change
 * describes the change, not the app.
 */
const SUPPRESSED_VERSION_PREFIXES = ["3."];

const appVersion = () => Application.nativeApplicationVersion ?? "unknown";

const isSuppressed = (version: string) =>
  SUPPRESSED_VERSION_PREFIXES.some((prefix) => version.startsWith(prefix));

/**
 * Counts launches on the running version. The count resets on an update, so a
 * long-standing user still uses a new release for a while before it asks them
 * to rate it.
 */
export const trackAppSession = async (): Promise<void> => {
  try {
    const version = appVersion();
    const countedVersion = await Storage.getItemAsync(SESSIONS_VERSION_KEY);

    if (countedVersion !== version) {
      await Storage.setItemAsync(SESSIONS_VERSION_KEY, version);
      await Storage.setItemAsync(SESSIONS_KEY, "1");
      return;
    }

    const raw = await Storage.getItemAsync(SESSIONS_KEY);
    const count = (raw ? parseInt(raw, 10) : 0) + 1;
    await Storage.setItemAsync(SESSIONS_KEY, String(count));
  } catch {
    // Non-critical
  }
};

export const promptReviewIfEligible = async (): Promise<void> => {
  try {
    const version = appVersion();
    const lastVersionPrompted = await Storage.getItemAsync(LAST_VERSION_KEY);
    if (version === lastVersionPrompted) return;

    // A suppressed release claims the version without prompting, so the skipped
    // prompt does not carry over and fire on the release after it.
    if (isSuppressed(version)) {
      await Storage.setItemAsync(LAST_VERSION_KEY, version);
      return;
    }

    const hasAction = await StoreReview.hasAction();
    if (!hasAction) return;

    const raw = await Storage.getItemAsync(SESSIONS_KEY);
    const sessions = raw ? parseInt(raw, 10) : 0;
    if (sessions < REQUIRED_SESSIONS) return;

    // The version is claimed before the request, not after. The OS rate-limits
    // this prompt and resolves either way, so a resolved call is no proof it
    // was shown — one attempt per version is the most that can be guaranteed.
    await Storage.setItemAsync(LAST_VERSION_KEY, version);

    await new Promise((resolve) => setTimeout(resolve, 2000));
    await StoreReview.requestReview();
  } catch {
    // Non-critical
  }
};
