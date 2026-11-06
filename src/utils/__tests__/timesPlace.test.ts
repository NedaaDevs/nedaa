import { ALARM_HYDRATION_TIMEOUT_MS } from "@/constants/Alarm";
import { TIMES_PLACE, type TimesPlace } from "@/constants/Location";
import { useLocationStore } from "@/stores/location";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { holdHydration } from "@/test-helpers/hydration";
import { placeFacts } from "@/test-helpers/place";
import { RIYADH_COORDS, RIYADH_DAY } from "@/test-helpers/prayerDay";
import { alarmLog } from "@/utils/alarmReport";
import {
  isVerifiedPlace,
  readTimesPlace,
  subscribeTimesPlace,
  timesPlace,
  todayStored,
} from "@/utils/timesPlace";

type Coords = typeof RIYADH_COORDS | null;

const HOLDS = [
  ["prayer times", () => holdHydration(usePrayerTimesStore)],
  ["location", () => holdHydration(useLocationStore)],
] as const;

let warn: jest.SpyInstance;
beforeEach(() => {
  placeFacts(false, RIYADH_COORDS);
  usePrayerTimesStore.setState({ todayTimings: RIYADH_DAY });
  warn = jest.spyOn(alarmLog, "w").mockImplementation(() => {});
});
afterEach(() => {
  warn.mockRestore();
  jest.useRealTimers();
});

describe("timesPlace", () => {
  it.each<[string, boolean, Coords, TimesPlace]>([
    ["coordinates and times loaded for them", false, RIYADH_COORDS, TIMES_PLACE.VERIFIED],
    ["no coordinates and the default place's times", true, null, TIMES_PLACE.DEFAULT],
    [
      "coordinates while the default place's times stand",
      true,
      RIYADH_COORDS,
      TIMES_PLACE.AWAITING_TIMES,
    ],
    // Times loaded for a place since cleared are still that place's.
    ["no coordinates under a verified flag", false, null, TIMES_PLACE.VERIFIED],
  ])("reads %s", (_, usingDefaultLocation, coords, place) => {
    placeFacts(usingDefaultLocation, coords);
    expect(timesPlace()).toBe(place);
  });

  it.each(HOLDS)("is unknown while the %s store loads", (_, hold) => {
    const held = hold();
    try {
      expect(timesPlace()).toBe(TIMES_PLACE.UNKNOWN);
      held.land();
      expect(timesPlace()).toBe(TIMES_PLACE.VERIFIED);
    } finally {
      held.restore();
    }
  });
});

describe("subscribeTimesPlace", () => {
  it("calls back as a store starts to load again, and once it has", async () => {
    const onChange = jest.fn();
    const stop = subscribeTimesPlace(onChange);
    try {
      const reload = usePrayerTimesStore.persist.rehydrate();
      expect(onChange).toHaveBeenCalled();
      expect(timesPlace()).toBe(TIMES_PLACE.UNKNOWN);

      onChange.mockClear();
      await reload;
      expect(onChange).toHaveBeenCalled();
      expect(timesPlace()).toBe(TIMES_PLACE.VERIFIED);
    } finally {
      stop();
    }
  });

  it("calls back on either store's facts, and not once stopped", () => {
    const onChange = jest.fn();
    const stop = subscribeTimesPlace(onChange);
    placeFacts(true, RIYADH_COORDS);
    expect(onChange).toHaveBeenCalledTimes(2);

    stop();
    placeFacts(false, RIYADH_COORDS);
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});

describe("readTimesPlace", () => {
  it.each(HOLDS)("waits for the %s store to load", async (_, hold) => {
    const held = hold();
    try {
      placeFacts(true, null);
      const read = readTimesPlace();
      placeFacts(false, RIYADH_COORDS);
      held.land();

      await expect(read).resolves.toBe(TIMES_PLACE.VERIFIED);
    } finally {
      held.restore();
    }
  });

  it.each(HOLDS)("is unknown when the %s store misses the cap", async (_, hold) => {
    jest.useFakeTimers();
    const held = hold();
    try {
      const read = readTimesPlace();
      await jest.advanceTimersByTimeAsync(ALARM_HYDRATION_TIMEOUT_MS);

      await expect(read).resolves.toBe(TIMES_PLACE.UNKNOWN);
      expect(warn).toHaveBeenCalledWith("Scheduler", expect.stringContaining("not hydrated"));
    } finally {
      held.restore();
    }
  });

  // Callers in one pass, such as the foreground work, must not stack waits.
  it.each(HOLDS)(
    "answers at once after the %s store missed the cap, until it loads",
    async (_, hold) => {
      jest.useFakeTimers();
      const held = hold();
      try {
        const first = readTimesPlace();
        await jest.advanceTimersByTimeAsync(ALARM_HYDRATION_TIMEOUT_MS);
        await expect(first).resolves.toBe(TIMES_PLACE.UNKNOWN);

        const answered = jest.fn();
        void readTimesPlace().then(answered);
        await jest.advanceTimersByTimeAsync(0);
        expect(answered).toHaveBeenCalledWith(TIMES_PLACE.UNKNOWN);
        expect(warn).toHaveBeenCalledTimes(1);

        held.land();
        await expect(readTimesPlace()).resolves.toBe(TIMES_PLACE.VERIFIED);
      } finally {
        held.restore();
      }
    }
  );
});

describe("isVerifiedPlace", () => {
  it("is true at a verified place", async () => {
    await expect(isVerifiedPlace()).resolves.toBe(true);
  });

  it("is true under a verified flag with no saved coordinates", async () => {
    placeFacts(false, null);
    await expect(isVerifiedPlace()).resolves.toBe(true);
  });

  it.each<[boolean, Coords]>([
    [true, null],
    [true, RIYADH_COORDS],
  ])("is false with the flag %s and coordinates %o", async (usingDefaultLocation, coords) => {
    placeFacts(usingDefaultLocation, coords);
    await expect(isVerifiedPlace()).resolves.toBe(false);
  });

  // Fail closed: a place that cannot be read is not verified.
  it("is false when a store misses the cap", async () => {
    jest.useFakeTimers();
    const held = holdHydration(useLocationStore);
    try {
      const verified = isVerifiedPlace();
      await jest.advanceTimersByTimeAsync(ALARM_HYDRATION_TIMEOUT_MS);

      await expect(verified).resolves.toBe(false);
    } finally {
      held.restore();
    }
  });
});

describe("todayStored", () => {
  it("is true with today stored at a verified place", () => {
    expect(todayStored()).toBe(true);
  });

  it("is false with nothing stored for today", () => {
    usePrayerTimesStore.setState({ todayTimings: null });
    expect(todayStored()).toBe(false);
  });

  it("is false at the default place's times", () => {
    placeFacts(true, null);
    expect(todayStored()).toBe(false);
  });

  it("is false while a store loads", () => {
    const held = holdHydration(usePrayerTimesStore);
    try {
      expect(todayStored()).toBe(false);
    } finally {
      held.restore();
    }
  });
});
