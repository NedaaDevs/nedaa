import { act, renderHook } from "@testing-library/react-native";

import { ALARM_TYPE } from "@/constants/Alarm";
import { useAlarmOn } from "@/hooks/useAlarmOn";
import { useAlarmStore } from "@/stores/alarm";
import { useAlarmSettingsStore } from "@/stores/alarmSettings";
import { useLocationStore } from "@/stores/location";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { holdHydration } from "@/test-helpers/hydration";
import { placeFacts } from "@/test-helpers/place";
import { RIYADH_COORDS } from "@/test-helpers/prayerDay";

const renderOn = () => renderHook(() => useAlarmOn(ALARM_TYPE.FAJR));

beforeEach(() => {
  const settings = useAlarmSettingsStore.getInitialState();
  useAlarmSettingsStore.setState({
    [ALARM_TYPE.FAJR]: { ...settings[ALARM_TYPE.FAJR], enabled: true },
  });
  useAlarmStore.setState({ scheduledAlarms: {} });
  placeFacts(false, RIYADH_COORDS);
});

describe("useAlarmOn with nothing armed", () => {
  it("reads On when turned on at a verified place", async () => {
    const { result } = await renderOn();
    expect(result.current).toBe(true);
  });

  it("reads Off when turned off", async () => {
    useAlarmSettingsStore.getState().setEnabled(ALARM_TYPE.FAJR, false);
    const { result } = await renderOn();
    expect(result.current).toBe(false);
  });

  it.each<[string, boolean, typeof RIYADH_COORDS | null, boolean]>([
    ["at the default place's times", true, null, false],
    ["with saved coordinates while the default place's times stand", true, RIYADH_COORDS, false],
    ["under a verified flag with no saved coordinates", false, null, true],
  ])("%s: reads On is %s", async (_, usingDefaultLocation, coords, on) => {
    placeFacts(usingDefaultLocation, coords);
    const { result } = await renderOn();
    expect(result.current).toBe(on);
  });

  it("reads On once a load verifies the place", async () => {
    placeFacts(true, RIYADH_COORDS);
    const { result } = await renderOn();

    await act(async () => usePrayerTimesStore.setState({ usingDefaultLocation: false }));

    expect(result.current).toBe(true);
  });

  it.each([
    ["prayer times", () => holdHydration(usePrayerTimesStore)],
    ["location", () => holdHydration(useLocationStore)],
  ] as const)("reads Off until the %s store loads", async (_, hold) => {
    const held = hold();
    try {
      const { result } = await renderOn();
      expect(result.current).toBe(false);

      await act(async () => held.land());

      expect(result.current).toBe(true);
    } finally {
      held.restore();
    }
  });
});
