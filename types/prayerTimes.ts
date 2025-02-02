export type PrayerTimesStoreState = {
  isLoading: boolean;
};

export type PrayerTimesStoreActions = {
  getPrayerTimes: (params: PrayerTimesParams) => Promise<PrayerTimesResponse>;
  getAndStorePrayerTimes: (params: PrayerTimesParams) => Promise<boolean>;
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

export type PrayerTimings = {
  fajr: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
};

export type OtherTimings = {
  sunrise: string;
  sunset: string;
  imsak: string;
  midnight: string;
  firstThird: string;
  lastThird: string;
};

export type DayPrayerTimes = {
  date: number;
  timezone: string;
  timings: PrayerTimings;
  otherTimings: OtherTimings;
};
