type GrantReads = Pick<
  typeof import("../index"),
  | "canScheduleExactAlarms"
  | "canUseFullScreenIntent"
  | "canDrawOverlays"
  | "isBatteryOptimizationExempt"
>;

const READS: (keyof GrantReads)[] = [
  "canScheduleExactAlarms",
  "canUseFullScreenIntent",
  "canDrawOverlays",
  "isBatteryOptimizationExempt",
];

/** The module over `nativeModule`, loaded fresh. */
const loadWith = (nativeModule: Record<string, jest.Mock> | null): GrantReads => {
  jest.doMock("expo-modules-core", () => ({
    ...jest.requireActual("expo-modules-core"),
    requireOptionalNativeModule: () => nativeModule,
  }));
  let subject: GrantReads | undefined;
  jest.isolateModules(() => {
    subject = jest.requireActual<GrantReads>("../index");
  });
  return subject!;
};

const nativeAnswering = (read: () => boolean) =>
  Object.fromEntries(READS.map((name) => [name, jest.fn(read)]));

afterEach(() => {
  jest.dontMock("expo-modules-core");
  jest.resetModules();
});

// A grant read that cannot answer means not granted, so no alarm counts on it.
describe("the Android grant reads", () => {
  it.each(READS)("%s is false without the native module", (name) => {
    expect(loadWith(null)[name]()).toBe(false);
  });

  it.each(READS)("%s is false when the native read throws", (name) => {
    const reads = loadWith(
      nativeAnswering(() => {
        throw new Error("native failure");
      })
    );

    expect(reads[name]()).toBe(false);
  });

  it.each(READS)("%s passes the native answer through", (name) => {
    expect(loadWith(nativeAnswering(() => true))[name]()).toBe(true);
    expect(loadWith(nativeAnswering(() => false))[name]()).toBe(false);
  });
});
