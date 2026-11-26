import type { EmergencyQuietControl } from "@/hooks/useAlarmScreen";

/** A ringing alarm's emergency quiet with nothing used, running or open. */
export const quietControl = (
  overrides: Partial<EmergencyQuietControl> = {}
): EmergencyQuietControl => ({
  hasTask: true,
  preview: false,
  snoozed: false,
  used: false,
  quietUntil: null,
  confirming: false,
  quieting: false,
  failed: false,
  open: jest.fn(),
  back: jest.fn(),
  confirm: jest.fn(() => Promise.resolve()),
  ...overrides,
});
