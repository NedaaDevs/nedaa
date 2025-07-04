export type AllTimings = {
  fajr: string;
  sunrise: string;
  dhuhr: string;
  asr: string;
  sunset: string;
  maghrib: string;
  isha: string;
  imsak: string;
  midnight: string;
  firstthird: string;
  lastthird: string;
};

export type PrayerMonthEntry = {
  date: string;
  timings: AllTimings;
};

export type PrayerTimesResponse = {
  timezone: string;
  months: {
    [monthNumber: string]: PrayerMonthEntry[];
  };
};

export type PrayerTimesParams = {
  lat: number;
  long: number;
};

export type PrayerName = "fajr" | "dhuhr" | "asr" | "maghrib" | "isha";

export type OtherTimingName =
  | "sunrise"
  | "sunset"
  | "imsak"
  | "midnight"
  | "firstthird"
  | "lastthird";

export type PrayerTimings = Record<PrayerName, string>;
export type OtherTimings = Record<OtherTimingName, string>;

export type DayPrayerTimes = {
  date: number;
  timezone: string;
  timings: PrayerTimings;
  otherTimings: OtherTimings;
};

export type Prayer = {
  name: PrayerName;
  time: string;
  date: number;
};

export type Provider = {
  id: number;
  name: string;
  website: string;
};

export type OtherTiming = {
  name: OtherTimingName;
  time: string;
  date: number;
};
