// A function task receives the matched files but returns a fixed command, so lint-staged
// appends nothing. `verify-hms-build.ts` reads argv[2] as an artifact path and would treat an
// appended filename as one.
const verifyHms = () => "bun run verify:android:hms";

export default {
  "*.{js,jsx,ts,tsx}": ["prettier --write", "eslint --max-warnings 1 --no-warn-ignored", "bun run lint"],
  "*.{json,md,yml}": ["prettier --write"],
  // The HMS variant is the only build that compiles the vendored expo-hms-notifications fork,
  // whose gradle guard pins the expo-notifications version it grafts sources from. A bump that
  // passes expo-doctor and the whole jest suite still breaks it, and only Gradle says so.
  // Scoped to the inputs that can break it, because the task is a ~30s Gradle run.
  "{package.json,bun.lock,modules/expo-hms-*/**,android/**}": verifyHms,
};
