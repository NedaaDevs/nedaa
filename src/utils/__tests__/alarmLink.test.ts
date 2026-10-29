import { ALARM_SCREEN_PATH, ALARM_SETTINGS_ROUTE } from "@/constants/Alarm";
import { isAlarmLink, linkPath } from "@/utils/alarmLink";

/** The scheme the native alarm module writes into its links. */
const NATIVE_ALARM_SCHEME = "dev.nedaa.app";
const QUERY = "?alarmId=alarm-1";
const link = (path: string) => `${NATIVE_ALARM_SCHEME}:/${path}${QUERY}`;

describe("linkPath", () => {
  it("reads the route after the scheme, without its query", () => {
    expect(linkPath(link(ALARM_SCREEN_PATH.RING))).toBe(ALARM_SCREEN_PATH.RING);
  });

  it("reads a link with an empty host the same way", () => {
    expect(linkPath(`${NATIVE_ALARM_SCHEME}://${ALARM_SCREEN_PATH.COMPLETE}`)).toBe(
      ALARM_SCREEN_PATH.COMPLETE
    );
  });
});

describe("isAlarmLink", () => {
  it.each(Object.values(ALARM_SCREEN_PATH))("takes %s as an alarm link", (path) => {
    expect(isAlarmLink(link(path))).toBe(true);
  });

  it("does not take a settings route that names alarms", () => {
    expect(isAlarmLink(link(`/${ALARM_SETTINGS_ROUTE}`))).toBe(false);
  });
});
