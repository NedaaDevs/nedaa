/**
 * Constants for prayer time providers
 * Each provider has a unique ID that corresponds to the API provider ID(hard coded)
 */

export const PRAYER_TIME_PROVIDERS = {
  ALADHAN: {
    id: 1,
    name: "Aladhan",
    website: "https://aladhan.com",
    docs: "https://aladhan.com/prayer-times-api",
    defaults: {
      method: undefined,
      shafaq: "general", // Defaults to general
      school: 0, // Default to Shafi
      midnightMode: 0, // Default to Standard
      calendarMethod: "HJCoSA", // Default: HJCoSA
      latitudeAdjustment: undefined,
    },
    methods: [
      { id: 3, nameKey: "mwl" },
      { id: 2, nameKey: "isna" },
      { id: 5, nameKey: "egyptian" },
      { id: 4, nameKey: "makkah" },
      { id: 1, nameKey: "karachi" },
      { id: 7, nameKey: "tehran" },
      { id: 0, nameKey: "shia" },
      { id: 8, nameKey: "gulf" },
      { id: 9, nameKey: "kuwait" },
      { id: 10, nameKey: "qatar" },
      { id: 11, nameKey: "singapore" },
      { id: 12, nameKey: "france" },
      { id: 13, nameKey: "turkey" },
      { id: 14, nameKey: "russia" },
      { id: 15, nameKey: "moonsighting" },
      { id: 16, nameKey: "dubai" },
      { id: 17, nameKey: "malaysia" },
      { id: 18, nameKey: "tunisia" },
      { id: 19, nameKey: "algeria" },
      { id: 20, nameKey: "indonesia" },
      { id: 21, nameKey: "morocco" },
      { id: 22, nameKey: "portugal" },
      { id: 23, nameKey: "jordan" },
    ],
    shafaqs: [
      { id: "general", nameKey: "general" },
      {
        id: "ahmer",
        nameKey: "ahmer",
      },
      {
        id: "abyad",
        nameKey: "abyad",
      },
    ],
    schools: [
      { id: 0, nameKey: "shafi" },
      { id: 1, nameKey: "hanafi" },
    ],
    midnightModes: [
      { id: 0, nameKey: "standard" },
      { id: 1, nameKey: "jafari" },
    ],
    latitudeAdjustmentMethods: [
      { id: 1, nameKey: "middleOfNight" },
      { id: 2, nameKey: "oneSeventh" },
      { id: 3, nameKey: "angleBased" },
    ],
    // Order is important for the api
    tuning: {
      imsak: 0,
      fajr: 0,
      sunrise: 0,
      dhuhr: 0,
      asr: 0,
      maghrib: 0,
      sunset: 0,
      isha: 0,
      midnight: 0,
    } as const,
  },

  // Provider two
} as const;

// Type for the providers constant
export type ProviderKey = keyof typeof PRAYER_TIME_PROVIDERS;
export type ProviderDetails = (typeof PRAYER_TIME_PROVIDERS)[ProviderKey];
