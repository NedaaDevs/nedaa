import { getCalendars } from "expo-localization";

type PhoneZoneReadings = {
  /** `Intl`'s resolved zone; null when unreadable. */
  intl: string | null;
  /** The first calendar's zone from expo-localization; null when absent. */
  calendar: string | null;
};

const readOrNull = (read: () => string | undefined): string | null => {
  try {
    return read() ?? null;
  } catch {
    return null;
  }
};

/** The phone's time zone from each source, for comparing how they refresh. */
export const phoneZoneReadings = (): PhoneZoneReadings => ({
  intl: readOrNull(() => Intl.DateTimeFormat().resolvedOptions().timeZone),
  calendar: readOrNull(() => getCalendars()[0]?.timeZone ?? undefined),
});

/** The phone's zone: the calendar's, else Intl's; null when both are empty. */
export const readPhoneZone = (): string | null => {
  const { calendar, intl } = phoneZoneReadings();
  return calendar || intl || null;
};
