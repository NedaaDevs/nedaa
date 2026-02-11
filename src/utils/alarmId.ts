/**
 * Generate a deterministic UUID from any input string.
 * Uses a simple hash algorithm - not cryptographic, but consistent.
 */
export function generateDeterministicUUID(input: string): string {
  // Simple hash using two different multipliers for better distribution
  let hash1 = 0;
  let hash2 = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash1 = ((hash1 << 5) - hash1 + char) | 0;
    hash2 = ((hash2 << 7) + hash2 + char) | 0;
  }

  // Convert to positive hex strings
  const hex1 = (hash1 >>> 0).toString(16).padStart(8, "0");
  const hex2 = (hash2 >>> 0).toString(16).padStart(8, "0");
  const hex3 = ((hash1 ^ hash2) >>> 0).toString(16).padStart(8, "0");
  const hex4 = ((hash1 + hash2) >>> 0).toString(16).padStart(8, "0");

  // Format as UUID v4: xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx
  return [
    hex1,
    hex2.slice(0, 4),
    "4" + hex2.slice(5, 8),
    "8" + hex3.slice(1, 4),
    hex3.slice(4, 8) + hex4,
  ]
    .join("-")
    .toLowerCase();
}

export function getAlarmKey(alarmType: string, triggerDate: Date): string {
  const dateStr = triggerDate.toISOString().split("T")[0]; // YYYY-MM-DD
  return `${alarmType}_${dateStr}`;
}

export function getSnoozeKey(alarmType: string, triggerDate: Date, snoozeCount: number): string {
  const dateStr = triggerDate.toISOString().split("T")[0];
  return `${alarmType}_${dateStr}_snooze${snoozeCount}`;
}
