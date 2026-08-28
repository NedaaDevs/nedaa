type NativeWidgetsModule = {
  isPersistentNotificationEnabled: jest.Mock;
  setPersistentNotificationEnabled: jest.Mock;
};

const loadSubject = (nativeModule: NativeWidgetsModule | null) => {
  jest.doMock("expo-modules-core", () => ({
    Platform: { OS: "android" },
    requireOptionalNativeModule: () => nativeModule,
  }));

  let subject: typeof import("../index");
  jest.isolateModules(() => {
    subject = jest.requireActual<typeof import("../index")>("../index");
  });
  return subject!;
};

describe("persistent notification widget bindings", () => {
  afterEach(() => {
    jest.dontMock("expo-modules-core");
    jest.resetModules();
  });

  it("reads and writes the native enabled flag", async () => {
    const nativeModule: NativeWidgetsModule = {
      isPersistentNotificationEnabled: jest.fn(() => true),
      setPersistentNotificationEnabled: jest.fn(() => Promise.resolve(true)),
    };
    const subject = loadSubject(nativeModule);

    expect(subject.isPersistentNotificationEnabled()).toBe(true);
    await expect(subject.setPersistentNotificationEnabled(false)).resolves.toBe(true);

    expect(nativeModule.isPersistentNotificationEnabled).toHaveBeenCalledTimes(1);
    expect(nativeModule.setPersistentNotificationEnabled).toHaveBeenCalledWith(false);
  });

  it("passes through a refusal from the native side", async () => {
    const nativeModule: NativeWidgetsModule = {
      isPersistentNotificationEnabled: jest.fn(() => false),
      setPersistentNotificationEnabled: jest.fn(() => Promise.resolve(false)),
    };
    const subject = loadSubject(nativeModule);

    await expect(subject.setPersistentNotificationEnabled(true)).resolves.toBe(false);
  });

  it("silently degrades when the native module is absent", async () => {
    const subject = loadSubject(null);

    expect(subject.isPersistentNotificationEnabled()).toBe(false);
    await expect(subject.setPersistentNotificationEnabled(true)).resolves.toBe(false);
  });
});
