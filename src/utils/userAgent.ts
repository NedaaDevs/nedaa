import * as Application from "expo-application";
import * as Device from "expo-device";
import { Platform } from "react-native";

// Single source of truth for the HTTP User-Agent sent on every outbound request.
// Privacy-respecting: app identity, version, build, platform, and OS version only.
// No device IDs, locale, advertising IDs, or model name. The values are fixed for
// a session, so the string is memoized once they resolve.
let cached: string | null = null;

export const getUserAgent = (): string => {
  if (cached) return cached;
  const version = Application.nativeApplicationVersion;
  const build = Application.nativeBuildVersion;
  const osVersion = Device.osVersion;
  const agent = `Nedaa/${version ?? "0"} (build ${build ?? "0"}; ${Platform.OS} ${osVersion ?? "?"})`;
  // Memoize only once the native constants have resolved. The first caller can be
  // a module-scope one at import time, and caching its fallback would pin every
  // request for the session to "Nedaa/0".
  if (version && build && osVersion) cached = agent;
  return agent;
};
