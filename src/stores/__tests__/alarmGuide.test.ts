import Storage from "expo-sqlite/kv-store";

import { ALARM_GUIDE_STORE_KEY } from "@/constants/DB";
import { useAlarmGuideStore } from "@/stores/alarmGuide";

const storage = jest.mocked(Storage);

const saved = (state: unknown) => JSON.stringify({ state, version: 0 });

beforeEach(() => {
  useAlarmGuideStore.setState({ hasSeenGuide: false });
  storage.setItem.mockClear();
});

describe("the alarm guide's seen mark", () => {
  it("starts unseen", () => {
    expect(useAlarmGuideStore.getState().hasSeenGuide).toBe(false);
  });

  it("writes only the mark under its own key", () => {
    useAlarmGuideStore.getState().markGuideSeen();

    expect(useAlarmGuideStore.getState().hasSeenGuide).toBe(true);
    expect(storage.setItem).toHaveBeenLastCalledWith(
      ALARM_GUIDE_STORE_KEY,
      saved({ hasSeenGuide: true })
    );
  });

  it("reads a saved mark back after a restart", async () => {
    storage.getItem.mockResolvedValueOnce(saved({ hasSeenGuide: true }));

    await useAlarmGuideStore.persist.rehydrate();

    expect(storage.getItem).toHaveBeenLastCalledWith(ALARM_GUIDE_STORE_KEY);
    expect(useAlarmGuideStore.persist.hasHydrated()).toBe(true);
    expect(useAlarmGuideStore.getState().hasSeenGuide).toBe(true);
  });

  it("reads a malformed record as unseen", async () => {
    storage.getItem.mockResolvedValueOnce(saved({ hasSeenGuide: "yes" }));

    await useAlarmGuideStore.persist.rehydrate();

    expect(useAlarmGuideStore.getState().hasSeenGuide).toBe(false);
  });

  it("stays unread when the read fails, so nothing opens by itself", async () => {
    storage.getItem.mockRejectedValueOnce(new Error("disk"));

    await useAlarmGuideStore.persist.rehydrate();

    expect(useAlarmGuideStore.persist.hasHydrated()).toBe(false);
  });
});
