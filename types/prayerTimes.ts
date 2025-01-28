export type PrayerTimesStoreState = {
  isLoading: boolean;
};

export type PrayerTimesStoreActions = {
  getPrayerTimes: (params: PrayerTimesParams) => Promise<PrayerTimesResponse>;
};

export type PrayerTimesStore = PrayerTimesStoreState & PrayerTimesStoreActions;

export type PrayerTimings = {
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
  timings: PrayerTimings;
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
