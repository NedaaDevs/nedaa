import { screen, userEvent } from "@testing-library/react-native";

import AlarmDebugScreen from "@/app/settings/alarm-debug";
import VolumeSlider from "@/components/alarm/VolumeSlider";
import { ALARM_TYPE } from "@/constants/Alarm";
import { ALARM_DEBUG_TEST_SECONDS, alarmDebugScheduleId } from "@/constants/E2E";
import { useAlarmSettingsStore } from "@/stores/alarmSettings";
import { renderWithTheme } from "@/test-helpers/theme";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock("@/components/ui/screen-header", () => ({ ScreenHeader: () => null }));
jest.mock("@/hooks/useHaptic", () => ({ useHaptic: () => jest.fn() }));
jest.mock("@/services/audio/previewPlayer", () => ({
  playPreview: () => Promise.resolve(),
  stopPreview: () => Promise.resolve(),
  addPreviewListener: () => () => {},
}));
// The athkar store opens SQLite, which has no native module in Jest.
jest.mock("@/stores/athkar", () => ({
  useAthkarStore: (select: (state: object) => unknown) => select({ streak: { currentStreak: 0 } }),
}));
// Scheduling needs the native alarm module; the settings write comes before it.
jest.mock("@/stores/alarm", () => ({
  useAlarmStore: () => ({ scheduleAlarm: async () => true, cancelAllAlarms: async () => {} }),
}));

/** The text of each volume step the panel draws. */
const VOLUME_STEP = /^\d+%$/;
const SCHEDULE_ID = alarmDebugScheduleId(ALARM_DEBUG_TEST_SECONDS[0]);

describe("Alarm debug volumes", () => {
  it("saves only volumes the volume picker can mark", async () => {
    const user = userEvent.setup();
    await renderWithTheme(<AlarmDebugScreen />);

    // The panel's volume reaches the store only when it schedules a test alarm.
    const saved: number[] = [];
    const count = screen.getAllByText(VOLUME_STEP).length;
    for (let i = 0; i < count; i++) {
      const step = screen.getAllByText(VOLUME_STEP)[i];
      await user.press(step);
      await user.press(screen.getByTestId(SCHEDULE_ID));
      const { volume } = useAlarmSettingsStore.getState()[ALARM_TYPE.FAJR];
      // Each step pressed saves its own volume.
      expect(step).toHaveTextContent(`${Math.round(volume * 100)}%`);
      saved.push(volume);
    }
    await screen.unmount();

    for (const volume of saved) {
      await renderWithTheme(<VolumeSlider value={volume} onChange={jest.fn()} />);
      expect(screen.getAllByRole("radio", { selected: true })).toHaveLength(1);
    }
  });
});
