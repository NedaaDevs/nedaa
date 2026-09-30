import * as Application from "expo-application";

const UNKNOWN = "?";

/** The release the store shows, such as 2.10.8. */
export const appVersion = (): string => Application.nativeApplicationVersion ?? UNKNOWN;

// The single build label for anything that records or compares a version across launches.
// One format everywhere means a sentinel written by one module still matches when another
// module reads it back on a later launch.
export const appVersionLabel = (): string =>
  `${appVersion()} (${Application.nativeBuildVersion ?? UNKNOWN})`;
