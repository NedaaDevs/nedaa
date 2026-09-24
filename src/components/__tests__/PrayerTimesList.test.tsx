import React from "react";
import renderer, { act } from "react-test-renderer";

import PrayerTimesList from "@/components/PrayerTimesList";
import type { DayPrayerTimes } from "@/types/prayerTimes";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("@/screenshot-mode/useScreenshotSeed", () => ({ useScreenshotSeed: () => null }));
jest.mock("@/hooks/useMinuteClock", () => ({
  useMinuteClock: () => new Date("2026-09-24T21:00:00.000Z"),
}));

let mockStore: Record<string, unknown> = {};
jest.mock("@/stores/prayerTimes", () => ({ usePrayerTimesStore: () => mockStore }));

// Layout only; each stands in as a plain view.
jest.mock("@/components/ui/skeleton", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require("react-native");
  return { Skeleton: View, SkeletonText: View };
});
jest.mock("@/components/ui/card", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return { Card: require("react-native").View };
});
jest.mock("@/components/ui/hstack", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return { HStack: require("react-native").View };
});
jest.mock("@/components/feedback", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return { EmptyState: require("react-native").View };
});

// Each row as "prayer time [next]", so a test reads what the list chose.
jest.mock("@/components/TimingItem", () => ({
  __esModule: true,
  default: ({ name, time, isNext }: { name: string; time: string; isNext: boolean }) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Text: RNText } = require("react-native");
    return <RNText>{`${name} ${time}${isNext ? " next" : ""}`}</RNText>;
  },
}));

const TODAY: DayPrayerTimes = {
  date: 20260924,
  timezone: "UTC",
  timings: {
    fajr: "2026-09-24T04:30:00.000Z",
    dhuhr: "2026-09-24T12:00:00.000Z",
    asr: "2026-09-24T15:20:00.000Z",
    maghrib: "2026-09-24T18:05:00.000Z",
    isha: "2026-09-24T19:25:00.000Z",
  },
  otherTimings: {} as DayPrayerTimes["otherTimings"],
};
const TOMORROW_FAJR = { name: "fajr", time: "2026-09-25T04:31:00.000Z", date: 20260925 } as const;

describe("PrayerTimesList after Isha", () => {
  beforeEach(() => {
    mockStore = {
      todayTimings: TODAY,
      hasError: false,
      isLoading: false,
      getNextPrayer: () => TOMORROW_FAJR,
    };
  });

  it("marks Fajr next, at tomorrow's time", () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<PrayerTimesList />);
    });
    const rows = JSON.stringify(tree.toJSON());

    expect(rows).toContain(`prayerTimes.fajr ${TOMORROW_FAJR.time} next`);
    expect(rows.match(/ next"/g)).toHaveLength(1);
  });
});
