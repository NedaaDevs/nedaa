import { applyProviderSettings } from "@/services/applyProviderSettings";

import type { ApplyStep } from "@/services/applyProviderSettings";

const makeDeps = () => ({
  saveSettings: jest.fn(() => Promise.resolve()),
  loadPrayerTimes: jest.fn(() => Promise.resolve()),
  scheduleAllNotifications: jest.fn(() => Promise.resolve()),
  rescheduleAllAlarms: jest.fn(() => Promise.resolve()),
  reloadPrayerWidgets: jest.fn(),
  markSettingsApplied: jest.fn(),
});

describe("applyProviderSettings", () => {
  test("announces each step in pipeline order", async () => {
    const steps: ApplyStep[] = [];

    await applyProviderSettings(makeDeps(), (step) => steps.push(step));

    expect(steps).toEqual(["prayerTimes", "notifications", "alarms"]);
  });

  test("forces the prayer times refetch", async () => {
    const deps = makeDeps();

    await applyProviderSettings(deps, () => {});

    expect(deps.loadPrayerTimes).toHaveBeenCalledWith(true);
  });

  test("marks the settings applied once every step has landed", async () => {
    const deps = makeDeps();

    await applyProviderSettings(deps, () => {});

    expect(deps.markSettingsApplied).toHaveBeenCalledTimes(1);
  });

  test("reloads the widgets before marking applied", async () => {
    const deps = makeDeps();
    const order: string[] = [];
    deps.reloadPrayerWidgets.mockImplementation(() => order.push("widgets"));
    deps.markSettingsApplied.mockImplementation(() => order.push("applied"));

    await applyProviderSettings(deps, () => {});

    expect(order).toEqual(["widgets", "applied"]);
  });

  test("leaves the settings unapplied when a step fails", async () => {
    const deps = makeDeps();
    deps.scheduleAllNotifications.mockRejectedValueOnce(new Error("no permission"));

    await expect(applyProviderSettings(deps, () => {})).rejects.toThrow("no permission");

    expect(deps.markSettingsApplied).not.toHaveBeenCalled();
  });

  test("stops the pipeline at the failed step", async () => {
    const deps = makeDeps();
    deps.loadPrayerTimes.mockRejectedValueOnce(new Error("offline"));

    await expect(applyProviderSettings(deps, () => {})).rejects.toThrow("offline");

    expect(deps.scheduleAllNotifications).not.toHaveBeenCalled();
    expect(deps.rescheduleAllAlarms).not.toHaveBeenCalled();
    expect(deps.reloadPrayerWidgets).not.toHaveBeenCalled();
  });

  test("reports which step failed", async () => {
    const deps = makeDeps();
    deps.rescheduleAllAlarms.mockRejectedValueOnce(new Error("alarm store down"));
    const steps: ApplyStep[] = [];

    await expect(applyProviderSettings(deps, (step) => steps.push(step))).rejects.toThrow();

    expect(steps[steps.length - 1]).toBe("alarms");
  });
});
