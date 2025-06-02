import { PRAYER_TIME_PROVIDERS } from "@/constants/providers";

/**
 * Types for Aladhan API
 */
type AlAdhan = typeof PRAYER_TIME_PROVIDERS.ALADHAN;

/**
 * Method types for prayer time calculation
 * @see https://aladhan.com/calculation-methods
 */
type Methods = AlAdhan["methods"];

/**
 * ID of the calculation method used by Aladhan API
 * - 0: Shia Ithna-Ashari, Leva Institute, Qum"
 * - 1: University of Islamic Sciences, Karachi
 * - 2: Islamic Society of North America (isna)
 * - 3: Muslim World League (mwl)
 * - 4: Umm Al-Qura University, Makkah
 * - 5: Egyptian General Authority of Survey
 * - 7: Institute of Geophysics, University of Tehran
 * - 8: Gulf Region
 * - 9: Kuwait
 * - 10: Qatar
 * - 11: Majlis Ugama Islam Singapura, Singapore
 * - 12: Union Organization Islamic de France
 * - 13: Diyanet İşleri Başkanlığı, Turkey (experimental)"
 * - 14: Spiritual Administration of Muslims of Russia
 * - 15: Moonsighting Committee Worldwide(Moonsighting.com)
 * - 16: Dubai (experimental)"
 * - 17: Jabatan Kemajuan Islam Malaysia (JAKIM)"
 * - 18: Tunisia
 * - 19: Algeria
 * - 20: Kementerian Agama Republik Indonesia"
 * - 21: Morocco
 * - 22: Comunidade Islamica de Lisboa"
 * - 23: Jordan (jordan)
 * @see https://aladhan.com/calculation-methods
 */
export type AladhanMethodId = Methods[number]["id"] | null;

/**
 * Full method object containing ID and name information
 * @example { id: 3, nameKey: "mwl" }
 */
export type AladhanMethod = Methods[number];

/**
 * Method name keys for translations
 * @example "mwl" | "isna" | "egyptian" etc.
 */
export type AladhanMethodNameKey = Methods[number]["nameKey"];

/**
 * School (madhab) types for Asr prayer calculation
 */
type Schools = AlAdhan["schools"];

/**
 * ID of the juristic school for Asr prayer calculation
 * - 0: Shafi'i, Maliki, Hanbali (standard) - Shadow length = object height + shadow length at noon
 * - 1: Hanafi - Shadow length = 2 × object height + shadow length at noon
 */
export type AladhanMadhabId = Schools[number]["id"];

/**
 * Full school object containing ID and name information
 */
export type AladhanSchool = Schools[number];

/**
 * Midnight calculation mode types
 */
type MidnightModes = AlAdhan["midnightModes"];

/**
 * Midnight calculation mode types
 */
type Shafaqs = AlAdhan["shafaqs"];

/**
 * ID of the midnight calculation mode
 * - 0: Standard (mid-point between Maghrib and Fajr)
 * - 1: Jafari (mid-point between Maghrib and Sunrise)
 */
export type AladhanMidnightModeId = MidnightModes[number]["id"];

/**
 * Full midnight mode object containing ID and name information
 */
export type AladhanMidnightMode = MidnightModes[number];

/**
 * Which Shafaq to use if the 'method' query parameter is 'Moonsighting Commitee Worldwide(15)'. Acceptable options are
 * 'general',
 * 'ahmer',
 * 'abyad'
 */
export type AladhanShafaq = Shafaqs[number]["id"];

/**
 * Latitude adjustment method types for high latitude locations
 */
type LatitudeAdjustments = AlAdhan["latitudeAdjustmentMethods"];

/**
 * Id of the latitude adjustment method
 * - 1: Middle of Night - Fajr and Isha at the middle of the night during the abnormal period
 * - 2: One-Seventh of Night - Fajr and Isha at 1/7th of the night during the abnormal period
 * - 3: Angle-Based - Uses the angle-based method even during the abnormal period
 */
export type AladhanLatitudeAdjustmentId = LatitudeAdjustments[number]["id"];

/**
 * Full latitude adjustment object containing ID and name information
 */
export type AladhanLatitudeAdjustment = LatitudeAdjustments[number];

/**
 * Prayer times that can be tuned
 * Order matches API's tune parameter:
 * Imsak, Fajr, Sunrise, Dhuhr, Asr, Maghrib, Sunset, Isha, Midnight
 */
export type AladhanPrayerTimeName =
  | "imsak"
  | "fajr"
  | "sunrise"
  | "dhuhr"
  | "asr"
  | "maghrib"
  | "sunset"
  | "isha"
  | "midnight";

/**
 * Prayer time adjustments in minutes
 * @example { imsak: 5, fajr: 3, sunrise: 5, dhuhr: 7, asr: 9, maghrib: -1, sunset: 0, isha: 8, midnight: -6 }
 */
export type AladhanTuning = Partial<Record<AladhanPrayerTimeName, number>>;

/**
 * Tuning string format for API requests
 * Order: Imsak,Fajr,Sunrise,Dhuhr,Asr,Maghrib,Sunset,Isha,Midnight
 * Values range from -60 to +60 minutes
 * @example "5,3,5,7,9,-1,0,8,-6"
 */
export type AladhanTuningString = string;
/**
 * Custom method settings for method=99
 * Format: FajrAngle,MaghribAngleOrMinsAfterSunset,IshaAngleOrMinsAfterMaghrib
 * @example "18.5,null,17.5"
 */
export type AladhanCustomMethodSettings =
  `${number | "null"},${number | "null"},${number | "null"}`;

/**
 * Settings for Aladhan API requests
 */
export interface AladhanSettings {
  /**
   * Calculation method for prayer times
   * @see AladhanMethodId for available options
   * Use 99 for custom method settings
   */
  method: AladhanMethodId; // TODO: 99 for custom method

  /**
   * Custom method settings when method=99
   * @see AladhanCustomMethodSettings
   */
  methodSettings?: AladhanCustomMethodSettings;

  /**
   * Juristic school for Asr prayer calculation
   * @see AladhanMadhabId for available options
   */
  madhab?: AladhanMadhabId;

  /**
   * Method to calculate midnight time
   * @see AladhanMidnightModeId for available options
   */
  midnightMode?: AladhanMidnightModeId;

  /**
   * Method to adjust prayer times in high latitude locations
   * @see AladhanLatitudeAdjustmentId for available options
   */
  latitudeAdjustment?: AladhanLatitudeAdjustmentId;

  /**
   * Fine adjustments to prayer times in minutes
   * Values can be positive or negative (-60 to +60)
   * @example { imsak: 5, fajr: 3, sunrise: 5, dhuhr: 7, asr: 9, maghrib: -1, sunset: 0, isha: 8, midnight: -6 }
   */
  tune?: AladhanTuning;
}

export type AladhanApiParams = {
  lat: number;
  long: number;
  year: number;
  month: number;
  method: AladhanMethodId;
};

/**
 * Provider defaults
 */
export type AladhanDefaults = typeof PRAYER_TIME_PROVIDERS.ALADHAN.defaults;
