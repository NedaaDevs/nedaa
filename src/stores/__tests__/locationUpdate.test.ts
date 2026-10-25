import { UPDATE_START, UPDATE_STEP, type UpdateStep } from "@/constants/Location";
import { LocationMode } from "@/enums/location";
import { useLocationStore } from "@/stores/location";
import { isRunning, useLocationUpdateStore, type UpdateStart } from "@/stores/locationUpdate";
import type { ManualLocation } from "@/types/location";

jest.mock("@/utils/appLogger", () => ({
  AppLogger: { create: () => ({ d: jest.fn(), i: jest.fn(), w: jest.fn(), e: jest.fn() }) },
}));

const DEVICE: UpdateStart = { kind: UPDATE_START.DEVICE };
const MAKKAH: ManualLocation = {
  cityId: 104515,
  name: "Makkah",
  names: { ar: "مكة المكرمة", ur: null, ms: null },
  region: null,
  countryCode: "SA",
  country: { name: "Saudi Arabia", names: { ar: "السعودية", ur: null, ms: null } },
  latitude: 21.4225,
  longitude: 39.8262,
  timezone: "Asia/Riyadh",
};

/** Steps that wait for the test to let them finish or throw. */
const heldSteps = () => {
  let finish: () => void = () => {};
  let fail: (error: Error) => void = () => {};
  const done = new Promise<void>((resolve, reject) => {
    finish = resolve;
    fail = reject;
  });
  let enter: (step: UpdateStep) => void = () => {};
  const steps = (onStep: (step: UpdateStep) => void) => {
    enter = onStep;
    return done;
  };
  return {
    steps,
    finish: () => finish(),
    fail: (error: Error) => fail(error),
    enter: (s: UpdateStep) => enter(s),
  };
};

const run = () => useLocationUpdateStore.getState().run;

beforeEach(() => useLocationUpdateStore.setState({ run: null }));

describe("the location update lock", () => {
  it("holds one run at a time, app-wide", async () => {
    const first = heldSteps();
    const second = jest.fn(async () => {});
    const running = useLocationUpdateStore.getState().withRun(DEVICE, first.steps);

    const refused = await useLocationUpdateStore.getState().withRun(DEVICE, second);

    expect(refused).toBe(false);
    expect(second).not.toHaveBeenCalled();
    first.finish();
    await expect(running).resolves.toBe(true);
  });

  // A screen opened mid-run reads the store, not its own state.
  it("shows a reader the run in flight and its current step", async () => {
    const held = heldSteps();
    const city: UpdateStart = { kind: UPDATE_START.CITY, city: MAKKAH };
    void useLocationUpdateStore.getState().withRun(city, held.steps);

    held.enter(UPDATE_STEP.PRAYER_TIMES);

    expect(run()).toEqual({ start: city, step: UPDATE_STEP.PRAYER_TIMES, failed: false });
    expect(isRunning(run())).toBe(true);
    held.finish();
  });

  it("starts at the location step", () => {
    void useLocationUpdateStore.getState().withRun(DEVICE, heldSteps().steps);

    expect(run()?.step).toBe(UPDATE_STEP.LOCATION);
  });

  it("clears the run once every step has run", async () => {
    await useLocationUpdateStore.getState().withRun(DEVICE, async (enter) => {
      enter(UPDATE_STEP.ALARMS);
    });

    expect(run()).toBeNull();
  });

  it("keeps the step a throw stopped at, and lets the next run start", async () => {
    const held = heldSteps();
    const running = useLocationUpdateStore.getState().withRun(DEVICE, held.steps);
    held.enter(UPDATE_STEP.NOTIFICATIONS);

    held.fail(new Error("denied"));

    await expect(running).resolves.toBe(false);
    expect(run()).toEqual({ start: DEVICE, step: UPDATE_STEP.NOTIFICATIONS, failed: true });
    expect(isRunning(run())).toBe(false);
    await expect(useLocationUpdateStore.getState().withRun(DEVICE, async () => {})).resolves.toBe(
      true
    );
  });

  // Every way out releases the lock, a synchronous throw included.
  it("releases the lock when the steps throw before their first await", async () => {
    const ran = await useLocationUpdateStore.getState().withRun(DEVICE, () => {
      throw new Error("no store");
    });

    expect(ran).toBe(false);
    expect(isRunning(run())).toBe(false);
  });

  it("closes a failed run on dismiss, and leaves a running one", async () => {
    await useLocationUpdateStore.getState().withRun(DEVICE, async () => {
      throw new Error("offline");
    });
    useLocationUpdateStore.getState().dismissFailure();
    expect(run()).toBeNull();

    const held = heldSteps();
    void useLocationUpdateStore.getState().withRun(DEVICE, held.steps);
    useLocationUpdateStore.getState().dismissFailure();

    expect(isRunning(run())).toBe(true);
    held.finish();
  });
});

// A retry repeats the run's start; once the place changes another way, that
// start is not the user's any more.
describe("a failed run after the place changes", () => {
  const failCity = () =>
    useLocationUpdateStore
      .getState()
      .withRun({ kind: UPDATE_START.CITY, city: MAKKAH }, async (enter) => {
        useLocationStore.getState().setManualLocation(MAKKAH);
        enter(UPDATE_STEP.PRAYER_TIMES);
        throw new Error("offline");
      });

  beforeEach(() =>
    useLocationStore.setState({ locationMode: LocationMode.DEVICE, manualLocation: null })
  );

  it("is dropped once the chosen city is cleared", async () => {
    await failCity();

    useLocationStore.getState().clearManualLocation();

    expect(run()).toBeNull();
  });

  it("stays while the place it wrote stands", async () => {
    await failCity();

    useLocationStore.getState().setAutoUpdateLocation(false);

    expect(run()).toEqual(expect.objectContaining({ failed: true }));
  });

  it("leaves a running run alone", () => {
    const held = heldSteps();
    void useLocationUpdateStore.getState().withRun(DEVICE, held.steps);

    useLocationStore.getState().setManualLocation(MAKKAH);

    expect(isRunning(run())).toBe(true);
    held.finish();
  });
});
