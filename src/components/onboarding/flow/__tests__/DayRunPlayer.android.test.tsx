import { act, screen, within } from "@testing-library/react-native";

import { DAY_RUN_PLAYER_PART } from "@/components/onboarding/flow/DayRunPlayer";
import { TEXT_END_ROOM } from "@/components/ui/text";
import { AppLocale, AppMode } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { usePreferencesStore } from "@/stores/preferences";
import { liveTime, renderPlayer } from "@/test-helpers/dayRunPlayer";
import { endRoomOf, hostNodesIn } from "@/test-helpers/text";

// Text reads the platform once, as it loads; this file runs as Android.
jest.mock("react-native", () => {
  const native = jest.requireActual("react-native");
  const { PlatformType } = jest.requireActual("@/enums/app");
  native.Platform.OS = PlatformType.ANDROID;
  return native;
});
jest.mock("expo-blur", () => jest.requireActual("@/test-helpers/blurMock"));
// A Reduce Motion run starts at Fajr, playing, with a time to show.
jest.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => true }));

const NOON = new Date(2026, 9, 24, 12, 30);
const hidden = { includeHiddenElements: true };

describe("DayRunPlayer on Android", () => {
  beforeEach(async () => {
    jest.useFakeTimers({ now: NOON });
    await act(() => i18n.changeLanguage(AppLocale.EN));
    useAppStore.setState({ locale: AppLocale.EN, mode: AppMode.SYSTEM });
    usePreferencesStore.setState({ use24HourTime: false, useWesternNumerals: true });
    // No stored times: the run plays the sample day.
    usePrayerTimesStore.setState({ todayTimings: null, usingDefaultLocation: false });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  // Running text gets room at its end. The live time is one Text, so it has the
  // room once; a reserve row is many glyphs and gets the room once, on the row.
  it("reserves each clock with the live time's end room, once per row", async () => {
    const { result } = await renderPlayer();
    await act(() => result.current.run?.start());
    expect(TEXT_END_ROOM).toBeGreaterThan(0);

    const slot = screen.getByTestId(DAY_RUN_PLAYER_PART.TIME_SLOT);
    const live = within(slot).getByText(liveTime(result));
    expect(endRoomOf(live)).toBe(TEXT_END_ROOM);

    const rows = within(slot).getAllByTestId(DAY_RUN_PLAYER_PART.CLOCK_RESERVE, hidden);
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      const rooms = hostNodesIn(row).map(endRoomOf);
      expect(rooms.reduce((sum, room) => sum + room, 0)).toBe(endRoomOf(live));
      expect(endRoomOf(row)).toBe(TEXT_END_ROOM);
    }
  });
});
