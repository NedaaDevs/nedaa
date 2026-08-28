export type PersistentNotificationToggleDeps = {
  setLocalEnabled: (enabled: boolean) => void;
  setNativeEnabled: (enabled: boolean) => Promise<boolean>;
};

/**
 * Applies the native setting optimistically and restores the previous value when the write fails
 * or the system refuses it. Resolves false when the setting did not take.
 */
export const applyPersistentNotificationToggle = async (
  enabled: boolean,
  previous: boolean,
  deps: PersistentNotificationToggleDeps
): Promise<boolean> => {
  deps.setLocalEnabled(enabled);
  try {
    const accepted = await deps.setNativeEnabled(enabled);
    if (!accepted) deps.setLocalEnabled(previous);
    return accepted;
  } catch (error) {
    deps.setLocalEnabled(previous);
    throw error;
  }
};
