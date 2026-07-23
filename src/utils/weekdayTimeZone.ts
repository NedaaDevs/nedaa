// Whether an instant lands on a Friday in a given IANA time zone. Prayer rows
// carry their own zone, so Jummah selection must not use device-local getDay():
// with data for another zone that can reject the valid Friday row or accept a
// Thursday. Falls back to device getDay() if the zone is unusable.
export const isFridayInTimeZone = (date: Date, timeZone: string): boolean => {
  try {
    const weekday = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
    }).format(date);
    return weekday === "Fri";
  } catch {
    return date.getDay() === 5;
  }
};
