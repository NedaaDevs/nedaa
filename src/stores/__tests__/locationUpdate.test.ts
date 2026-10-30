import {
  RUN_END,
  STEP_OUTCOME,
  UPDATE_START,
  UPDATE_STEP,
  type StepOutcome,
  type UpdateStep,
} from "@/constants/Location";
import { TRAVEL_MODE } from "@/constants/CityCheck";
import { LocationMode } from "@/enums/location";
import { useLocationStore } from "@/stores/location";
import {
  findingCity,
  isRunning,
  useLocationUpdateStore,
  type UpdateStart,
  type UpdateSteps,
} from "@/stores/locationUpdate";
import { candidateAt } from "@/test-helpers/cityOffer";
import type { ManualLocation } from "@/types/location";

jest.mock("@/utils/appLogger", () => {
  const log = { d: jest.fn(), i: jest.fn(), w: jest.fn(), e: jest.fn() };
  return { AppLogger: { create: () => log } };
});
/** The one logger every module in this suite writes to. */
const mockLog: { w: jest.Mock } = jest.requireMock("@/utils/appLogger").AppLogger.create();

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

/** One step whose work waits for the test to finish it or make it throw. */
const heldSteps = (step: UpdateStep = UPDATE_STEP.LOCATION) => {
  let finish: (outcome: StepOutcome) => void = () => {};
  let fail: (error: Error) => void = () => {};
  const work = new Promise<StepOutcome>((resolve, reject) => {
    finish = resolve;
    fail = reject;
  });
  const steps: UpdateSteps = async (runStep) => {
    await runStep(step, () => work);
  };
  return {
    steps,
    finish: (outcome: StepOutcome = STEP_OUTCOME.DONE) => finish(outcome),
    fail: (error: Error) => fail(error),
  };
};
const LANDED = expect.objectContaining({ end: RUN_END.LANDED });
const STOPPED = expect.objectContaining({ end: RUN_END.STOPPED });

const run = () => useLocationUpdateStore.getState().run;

beforeEach(() => useLocationUpdateStore.setState({ run: null }));

type StartKind = UpdateStart["kind"];

/** One start of each kind, and whether its place step reads the device. */
const STARTS: Record<StartKind, { start: UpdateStart; readsDevice: boolean }> = {
  [UPDATE_START.DEVICE]: { start: { kind: UPDATE_START.DEVICE }, readsDevice: true },
  [UPDATE_START.ADOPT_DEVICE]: { start: { kind: UPDATE_START.ADOPT_DEVICE }, readsDevice: true },
  [UPDATE_START.CITY]: { start: { kind: UPDATE_START.CITY, city: MAKKAH }, readsDevice: false },
  [UPDATE_START.CANDIDATE]: {
    start: { kind: UPDATE_START.CANDIDATE, candidate: candidateAt() },
    readsDevice: false,
  },
};

describe("findingCity", () => {
  it.each(Object.values(UPDATE_START))(
    "says whether a %s run is finding the city at its place step",
    (kind) => {
      const { start, readsDevice } = STARTS[kind];

      expect(findingCity({ start, step: UPDATE_STEP.LOCATION, failed: false })).toBe(readsDevice);
      expect(findingCity({ start, step: UPDATE_STEP.PRAYER_TIMES, failed: false })).toBe(false);
      expect(findingCity({ start, step: UPDATE_STEP.LOCATION, failed: true })).toBe(false);
    }
  );
});

describe("the location update lock", () => {
  it("holds one run at a time, app-wide", async () => {
    const first = heldSteps();
    const second = jest.fn(async () => {});
    const running = useLocationUpdateStore.getState().withRun(DEVICE, first.steps);

    const refused = await useLocationUpdateStore.getState().withRun(DEVICE, second);

    expect(refused).toEqual({ end: RUN_END.REFUSED });
    expect(second).not.toHaveBeenCalled();
    first.finish();
    await expect(running).resolves.toEqual(LANDED);
  });

  // A screen opened mid-run reads the store, not its own state.
  it("shows a reader the run in flight and its current step", async () => {
    const held = heldSteps(UPDATE_STEP.PRAYER_TIMES);
    const city: UpdateStart = { kind: UPDATE_START.CITY, city: MAKKAH };
    void useLocationUpdateStore.getState().withRun(city, held.steps);

    expect(run()).toEqual({ start: city, step: UPDATE_STEP.PRAYER_TIMES, failed: false });
    expect(isRunning(run())).toBe(true);
    held.finish();
  });

  it("starts at the location step", () => {
    void useLocationUpdateStore.getState().withRun(DEVICE, heldSteps().steps);

    expect(run()?.step).toBe(UPDATE_STEP.LOCATION);
  });

  it("clears the run once every step has run", async () => {
    await useLocationUpdateStore.getState().withRun(DEVICE, async (runStep) => {
      await runStep(UPDATE_STEP.ALARMS, async () => STEP_OUTCOME.DONE);
    });

    expect(run()).toBeNull();
  });

  it("keeps the step a throw stopped at, and lets the next run start", async () => {
    const held = heldSteps(UPDATE_STEP.NOTIFICATIONS);
    const running = useLocationUpdateStore.getState().withRun(DEVICE, held.steps);

    held.fail(new Error("denied"));

    await expect(running).resolves.toEqual(STOPPED);
    expect(run()).toEqual({ start: DEVICE, step: UPDATE_STEP.NOTIFICATIONS, failed: true });
    expect(isRunning(run())).toBe(false);
    await expect(
      useLocationUpdateStore.getState().withRun(DEVICE, async () => {})
    ).resolves.toEqual(LANDED);
  });

  // Every way out releases the lock, a synchronous throw included.
  it("releases the lock when the steps throw before their first await", async () => {
    const ran = await useLocationUpdateStore.getState().withRun(DEVICE, () => {
      throw new Error("no store");
    });

    expect(ran).toEqual(STOPPED);
    expect(isRunning(run())).toBe(false);
  });

  it("releases the lock when logging a throw throws too", async () => {
    mockLog.w.mockImplementation(() => {
      throw new Error("log full");
    });
    try {
      const failing = useLocationUpdateStore.getState().withRun(DEVICE, async (runStep) => {
        await runStep(UPDATE_STEP.PRAYER_TIMES, async () => {
          throw new Error("offline");
        });
      });
      await expect(failing).rejects.toThrow("log full");
    } finally {
      mockLog.w.mockReset();
    }

    expect(isRunning(run())).toBe(false);
    await expect(
      useLocationUpdateStore.getState().withRun(DEVICE, async () => {})
    ).resolves.toEqual(LANDED);
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

  it("resolves landed with every step's outcome", async () => {
    const result = await useLocationUpdateStore.getState().withRun(DEVICE, async (runStep) => {
      await runStep(UPDATE_STEP.LOCATION, async () => STEP_OUTCOME.DONE);
      await runStep(UPDATE_STEP.PRAYER_TIMES, async () => STEP_OUTCOME.PARTIAL);
    });

    expect(result).toEqual({
      end: RUN_END.LANDED,
      outcomes: {
        [UPDATE_STEP.LOCATION]: STEP_OUTCOME.DONE,
        [UPDATE_STEP.PRAYER_TIMES]: STEP_OUTCOME.PARTIAL,
      },
    });
    expect(run()).toBeNull();
  });

  it("stops at the first stopping outcome, after running the steps behind it", async () => {
    const alarms = jest.fn(async () => STEP_OUTCOME.DONE);
    const result = await useLocationUpdateStore.getState().withRun(DEVICE, async (runStep) => {
      await runStep(UPDATE_STEP.NOTIFICATIONS, async () => STEP_OUTCOME.FAILED);
      await runStep(UPDATE_STEP.ALARMS, alarms);
    });

    expect(alarms).toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({ end: RUN_END.STOPPED, step: UPDATE_STEP.NOTIFICATIONS })
    );
    expect(run()).toEqual({ start: DEVICE, step: UPDATE_STEP.NOTIFICATIONS, failed: true });
  });

  const EVERY_STEP = Object.values(UPDATE_STEP);

  // The widgets reload after the last step; every step's alerts landed.
  it("lands when a throw follows every step", async () => {
    const result = await useLocationUpdateStore.getState().withRun(DEVICE, async (runStep) => {
      for (const step of EVERY_STEP) await runStep(step, async () => STEP_OUTCOME.DONE);
      throw new Error("widgets");
    });

    expect(result).toEqual({
      end: RUN_END.LANDED,
      outcomes: Object.fromEntries(EVERY_STEP.map((step) => [step, STEP_OUTCOME.DONE])),
    });
    expect(run()).toBeNull();
  });

  // The steps after the throw never ran, so the run did not land.
  it("stops at the first step left unrun by a throw between steps", async () => {
    const result = await useLocationUpdateStore.getState().withRun(DEVICE, async (runStep) => {
      await runStep(UPDATE_STEP.LOCATION, async () => STEP_OUTCOME.DONE);
      throw new Error("between");
    });

    expect(result).toEqual({
      end: RUN_END.STOPPED,
      step: UPDATE_STEP.PRAYER_TIMES,
      outcomes: {
        [UPDATE_STEP.LOCATION]: STEP_OUTCOME.DONE,
        [UPDATE_STEP.PRAYER_TIMES]: STEP_OUTCOME.FAILED,
      },
    });
    expect(run()).toEqual({ start: DEVICE, step: UPDATE_STEP.PRAYER_TIMES, failed: true });
  });

  it("records a throw as a failed outcome at its step", async () => {
    const result = await useLocationUpdateStore.getState().withRun(DEVICE, async (runStep) => {
      await runStep(UPDATE_STEP.PRAYER_TIMES, async () => {
        throw new Error("offline");
      });
    });

    expect(result).toEqual({
      end: RUN_END.STOPPED,
      step: UPDATE_STEP.PRAYER_TIMES,
      outcomes: { [UPDATE_STEP.PRAYER_TIMES]: STEP_OUTCOME.FAILED },
    });
  });
});

// A retry repeats the run's start; once the place changes another way, that
// start is not the user's any more.
describe("a failed run after the place changes", () => {
  const failCity = () =>
    useLocationUpdateStore
      .getState()
      .withRun({ kind: UPDATE_START.CITY, city: MAKKAH }, async (runStep) => {
        await runStep(UPDATE_STEP.LOCATION, async () => {
          useLocationStore.getState().setManualLocation(MAKKAH);
          return STEP_OUTCOME.DONE;
        });
        await runStep(UPDATE_STEP.PRAYER_TIMES, async () => {
          throw new Error("offline");
        });
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

    useLocationStore.getState().setTravelMode(TRAVEL_MODE.OFF);

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
