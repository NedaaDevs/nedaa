// Google Cloud project number backing Play Integrity for the Android app. Public identifier
// (not a secret) — safe to commit. Replace with the real number from the Play Console setup.
export const CLOUD_PROJECT_NUMBER = "REPLACE_WITH_CLOUD_PROJECT_NUMBER";

// A real cloud project number is all digits; the placeholder is not.
export const isCloudProjectConfigured = (): boolean => /^\d+$/.test(CLOUD_PROJECT_NUMBER);
