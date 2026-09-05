import * as Application from "expo-application";

// The single build label for anything that records or compares a version across launches.
// One format everywhere means a sentinel written by one module still matches when another
// module reads it back on a later launch.
export const appVersionLabel = (): string =>
  `${Application.nativeApplicationVersion ?? "?"} (${Application.nativeBuildVersion ?? "?"})`;
