import type { ReminderPermissionOutcome } from "@/hooks/useReminderPermission";

type ToggleDeps = {
  ensure: () => Promise<ReminderPermissionOutcome>;
  setEnabled: (enabled: boolean) => Promise<void>;
};

// Turning a reminder on primes notification permission first: enable only if
// granted, otherwise leave it off and surface the recovery hint. Turning it off
// always applies. Returns the resolved UI state for the row.
export const applyReminderToggle = async (
  next: boolean,
  deps: ToggleDeps
): Promise<{ enabled: boolean; denied: boolean }> => {
  if (!next) {
    await deps.setEnabled(false);
    return { enabled: false, denied: false };
  }
  const outcome = await deps.ensure();
  if (outcome === "granted") {
    await deps.setEnabled(true);
    return { enabled: true, denied: false };
  }
  return { enabled: false, denied: true };
};
