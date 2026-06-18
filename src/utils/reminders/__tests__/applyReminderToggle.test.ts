import { applyReminderToggle } from "@/utils/reminders/applyReminderToggle";

describe("applyReminderToggle", () => {
  it("enables and clears denial when permission is granted", async () => {
    const setEnabled = jest.fn(() => Promise.resolve());
    const ensure = jest.fn(() => Promise.resolve("granted" as const));
    const result = await applyReminderToggle(true, { ensure, setEnabled });
    expect(ensure).toHaveBeenCalled();
    expect(setEnabled).toHaveBeenCalledWith(true);
    expect(result).toEqual({ enabled: true, denied: false });
  });

  it("does not enable and flags denial when permission is denied", async () => {
    const setEnabled = jest.fn(() => Promise.resolve());
    const ensure = jest.fn(() => Promise.resolve("denied" as const));
    const result = await applyReminderToggle(true, { ensure, setEnabled });
    expect(setEnabled).not.toHaveBeenCalled();
    expect(result).toEqual({ enabled: false, denied: true });
  });

  it("disables without priming when turning off", async () => {
    const setEnabled = jest.fn(() => Promise.resolve());
    const ensure = jest.fn(() => Promise.resolve("granted" as const));
    const result = await applyReminderToggle(false, { ensure, setEnabled });
    expect(ensure).not.toHaveBeenCalled();
    expect(setEnabled).toHaveBeenCalledWith(false);
    expect(result).toEqual({ enabled: false, denied: false });
  });
});
