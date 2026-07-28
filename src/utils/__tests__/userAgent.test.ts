import { Platform } from "react-native";

// Getters, not plain values: Babel's interop copies data properties out of a
// mock factory's return, so a later mutation would be invisible to the module
// under test. Accessors are copied as descriptors and stay live.
let mockVersion: string | null = "2.9.7";
let mockBuild: string | null = "468";
let mockOsVersion: string | null = "18.5";

jest.mock("expo-application", () => ({
  get nativeApplicationVersion() {
    return mockVersion;
  },
  get nativeBuildVersion() {
    return mockBuild;
  },
}));
jest.mock("expo-device", () => ({
  get osVersion() {
    return mockOsVersion;
  },
}));

// Fresh module per test so the memoized string doesn't leak between cases.
const loadUserAgent = (): (() => string) => {
  jest.resetModules();
  // require, not import: a static import binds once, and each case needs a module
  // instance with an empty memo.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("@/utils/userAgent").getUserAgent;
};

describe("getUserAgent", () => {
  beforeEach(() => {
    mockVersion = "2.9.7";
    mockBuild = "468";
    mockOsVersion = "18.5";
  });

  it("carries app version, build, platform, and OS version", () => {
    expect(loadUserAgent()()).toBe(`Nedaa/2.9.7 (build 468; ${Platform.OS} 18.5)`);
  });

  it("reuses the string once the native values have resolved", () => {
    const getUserAgent = loadUserAgent();
    const first = getUserAgent();
    mockVersion = "9.9.9";
    expect(getUserAgent()).toBe(first);
  });

  it("falls back rather than throwing when a native value is missing", () => {
    mockVersion = null;
    mockBuild = null;
    mockOsVersion = null;
    expect(loadUserAgent()()).toBe(`Nedaa/0 (build 0; ${Platform.OS} ?)`);
  });

  // The first caller is a module-scope one in services/api.ts, which runs at
  // import time. Memoizing a fallback there would pin every request for the
  // whole session to "Nedaa/0".
  it("does not memoize a fallback, so a later call picks up the real values", () => {
    mockVersion = null;
    const getUserAgent = loadUserAgent();
    expect(getUserAgent()).toBe(`Nedaa/0 (build 468; ${Platform.OS} 18.5)`);

    mockVersion = "2.9.7";
    expect(getUserAgent()).toBe(`Nedaa/2.9.7 (build 468; ${Platform.OS} 18.5)`);
  });

  it("carries no device identifier, model, or locale", () => {
    const ua = loadUserAgent()();
    expect(ua).not.toMatch(/iPhone|Pixel|model|locale|[0-9a-f]{8}-[0-9a-f]{4}/i);
  });
});
