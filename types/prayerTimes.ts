export type PrayerTimesStoreState = {
  isLoading: boolean;
  yesterdayTimings: DayPrayerTimes | null;
  todayTimings: DayPrayerTimes | null;
  tomorrowTimings: DayPrayerTimes | null;
};

export type PrayerTimesStoreActions = {
  getPrayerTimes: (params: PrayerTimesParams) => Promise<PrayerTimesResponse>;
  getAndStorePrayerTimes: (params: PrayerTimesParams) => Promise<boolean>;
  loadPrayerTimes: (dateInt: number, forceGetAndStore?: boolean) => Promise<void>;
  getNextPrayer: () => Prayer | null;
  getPreviousPrayer: () => Prayer | null;
};

export type PrayerTimesStore = PrayerTimesStoreState & PrayerTimesStoreActions;

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
  | "firstThird"
  | "lastThird";

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
