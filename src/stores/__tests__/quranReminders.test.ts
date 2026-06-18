import { useQuranRemindersStore } from "@/stores/quranReminders";
import { rearmReminders } from "@/utils/reminders/rearmReminders";
import { QURAN_REMINDER_ID, Weekday } from "@/enums/quranReminders";

jest.mock("expo-sqlite/kv-store", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock("@/utils/reminders/rearmReminders", () => ({
  rearmReminders: jest.fn(() => Promise.resolve()),
}));

const mockRearm = rearmReminders as jest.Mock;

describe("quranReminders store", () => {
  beforeEach(() => {
    mockRearm.mockClear();
    useQuranRemindersStore.setState({
      reminders: [
        {
          id: QURAN_REMINDER_ID,
          target: { kind: "surah", surah: 18 },
          schedule: { freq: "weekly", weekday: Weekday.FRIDAY, hour: 9, minute: 0 },
          enabled: false,
        },
      ],
    });
  });

  it("seeds Al-Kahf disabled, Friday 09:00, surah 18", () => {
    const r = useQuranRemindersStore.getState().getReminder(QURAN_REMINDER_ID);
    expect(r?.enabled).toBe(false);
    expect(r?.target).toEqual({ kind: "surah", surah: 18 });
    expect(r?.schedule).toEqual({ freq: "weekly", weekday: Weekday.FRIDAY, hour: 9, minute: 0 });
  });

  it("setEnabled flips state and re-arms", async () => {
    await useQuranRemindersStore.getState().setEnabled(QURAN_REMINDER_ID, true);
    expect(useQuranRemindersStore.getState().getReminder(QURAN_REMINDER_ID)?.enabled).toBe(true);
    expect(mockRearm).toHaveBeenCalledTimes(1);
  });

  it("setTime updates hour/minute and re-arms", () => {
    useQuranRemindersStore.getState().setTime(QURAN_REMINDER_ID, 7, 15);
    const r = useQuranRemindersStore.getState().getReminder(QURAN_REMINDER_ID);
    expect(r?.schedule).toMatchObject({ hour: 7, minute: 15 });
    expect(mockRearm).toHaveBeenCalledTimes(1);
  });
});
