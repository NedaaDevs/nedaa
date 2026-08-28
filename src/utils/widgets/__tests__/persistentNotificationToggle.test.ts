import { applyPersistentNotificationToggle } from "@/utils/widgets/persistentNotificationToggle";

describe("applyPersistentNotificationToggle", () => {
  it("updates local state and native state together", async () => {
    const setLocalEnabled = jest.fn();
    const setNativeEnabled = jest.fn(() => Promise.resolve(true));

    await expect(
      applyPersistentNotificationToggle(true, false, { setLocalEnabled, setNativeEnabled })
    ).resolves.toBe(true);

    expect(setLocalEnabled).toHaveBeenCalledWith(true);
    expect(setNativeEnabled).toHaveBeenCalledWith(true);
  });

  it("restores the previous local state when the system refuses the change", async () => {
    const setLocalEnabled = jest.fn();
    const setNativeEnabled = jest.fn(() => Promise.resolve(false));

    await expect(
      applyPersistentNotificationToggle(true, false, { setLocalEnabled, setNativeEnabled })
    ).resolves.toBe(false);

    expect(setLocalEnabled).toHaveBeenNthCalledWith(1, true);
    expect(setLocalEnabled).toHaveBeenNthCalledWith(2, false);
  });

  it("restores the previous local state when native state fails", async () => {
    const setLocalEnabled = jest.fn();
    const error = new Error("native unavailable");
    const setNativeEnabled = jest.fn(() => Promise.reject(error));

    await expect(
      applyPersistentNotificationToggle(true, false, { setLocalEnabled, setNativeEnabled })
    ).rejects.toThrow(error);

    expect(setLocalEnabled).toHaveBeenNthCalledWith(1, true);
    expect(setLocalEnabled).toHaveBeenNthCalledWith(2, false);
  });
});
