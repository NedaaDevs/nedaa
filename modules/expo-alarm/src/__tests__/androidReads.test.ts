import { Platform } from "react-native";

type Module = typeof import("../index");
type ReadName = "usesNativeOverlay" | "isOverlayShowing" | "getRingingAlarmId";
type Subject = Pick<Module, ReadName | "getFutureAlarmIds">;
type OS = typeof Platform.OS;

const ANDROID: OS = "android";
const IOS: OS = "ios";
const RINGING_ID = "alarm-1";

/** The module over `nativeModule` on `os`, loaded fresh. */
const loadWith = (os: OS, nativeModule: Record<string, jest.Mock> | null): Subject => {
  jest.doMock("expo-modules-core", () => ({
    ...jest.requireActual("expo-modules-core"),
    requireOptionalNativeModule: () => nativeModule,
  }));
  let subject: Subject | undefined;
  // ../index resolves react-native on use, so the OS is set out here.
  jest.replaceProperty(Platform, "OS", os);
  jest.isolateModules(() => {
    subject = jest.requireActual<Subject>("../index");
  });
  return subject!;
};

afterEach(() => {
  jest.dontMock("expo-modules-core");
  jest.restoreAllMocks();
  jest.resetModules();
});

// Each read: an Android answer, and what every failure gives instead. The
// fallbacks send a ringing alarm to the app's screen and keep the age rule.
const READS: readonly { name: ReadName; answer: unknown; fallback: unknown }[] = [
  { name: "usesNativeOverlay", answer: true, fallback: false },
  { name: "isOverlayShowing", answer: true, fallback: false },
  { name: "getRingingAlarmId", answer: RINGING_ID, fallback: null },
];

describe.each(READS)("$name", ({ name, answer, fallback }) => {
  it("passes the Android answer through", () => {
    expect(loadWith(ANDROID, { [name]: jest.fn(() => answer) })[name]()).toBe(answer);
  });

  it("falls back when the Android read throws", () => {
    const native = {
      [name]: jest.fn(() => {
        throw new Error("native failure");
      }),
    };

    expect(loadWith(ANDROID, native)[name]()).toBe(fallback);
  });

  it("falls back without the native module", () => {
    expect(loadWith(ANDROID, null)[name]()).toBe(fallback);
  });

  it("falls back on iOS without asking native", () => {
    const native = { [name]: jest.fn(() => answer) };

    expect(loadWith(IOS, native)[name]()).toBe(fallback);
    expect(native[name]).not.toHaveBeenCalled();
  });
});

it("reads a silent Android service as no ringing alarm", () => {
  expect(loadWith(ANDROID, { getRingingAlarmId: jest.fn(() => null) }).getRingingAlarmId()).toBe(
    null
  );
});

describe("getFutureAlarmIds", () => {
  const ids = [RINGING_ID];

  it("passes the Android list through", async () => {
    expect(
      await loadWith(ANDROID, { getFutureAlarmIds: jest.fn(async () => ids) }).getFutureAlarmIds()
    ).toEqual(ids);
  });

  it("is empty when the Android read rejects", async () => {
    const native = { getFutureAlarmIds: jest.fn(async () => Promise.reject(new Error("native"))) };

    expect(await loadWith(ANDROID, native).getFutureAlarmIds()).toEqual([]);
  });

  it("is empty without the native module", async () => {
    expect(await loadWith(ANDROID, null).getFutureAlarmIds()).toEqual([]);
  });

  it("is empty on iOS without asking native", async () => {
    const native = { getFutureAlarmIds: jest.fn(async () => ids) };

    expect(await loadWith(IOS, native).getFutureAlarmIds()).toEqual([]);
    expect(native.getFutureAlarmIds).not.toHaveBeenCalled();
  });
});
