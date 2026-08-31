export const DB_NAME = "nedaa.db" as const;
export const TABLE_NAME = "prayer_times" as const;
export const ATHKAR_DB_NAME = "athkar.db" as const;

export const ATHKAR_STREAK_TABLE = "athkar_streak" as const;
export const ATHKAR_COMPLETED_DAYS_TABLE = "athkar_completed_days" as const;
export const ATHKAR_DAILY_ITEMS_TABLE = "athkar_daily_items" as const;
export const ATHKAR_AUDIO_DOWNLOADS_TABLE = "athkar_audio_downloads" as const;

export const HISN_MUSLIM_DB_NAME = "hisn-muslim.db" as const;
export const MY_ATHKAR_TABLE = "my_athkar" as const;
export const MY_ATHKAR_DAILY_TABLE = "my_athkar_daily" as const;

export const CUSTOM_ATHKAR_GROUPS_TABLE = "custom_athkar_groups" as const;
export const CUSTOM_ATHKAR_ITEMS_TABLE = "custom_athkar_items" as const;
export const CUSTOM_ATHKAR_DAILY_TABLE = "custom_athkar_daily" as const;

export const QURAN_DB_NAME = "quran.db" as const;
export const QURAN_BOUNDS_DB_NAME = "bounds.db" as const;

export const CITIES_SEED_DB_NAME = "cities-seed.db" as const;
export const CITIES_DB_NAME = "cities.db" as const;

// Open options for any connection whose schema has an FTS5 table. expo-sqlite's close sweep
// finalizes every statement on the connection, FTS5's internal ones included, and FTS5 frees
// the same pointers again on disconnect — the double free aborts the process.
export const FTS_DB_OPEN_OPTIONS = {
  useNewConnection: true,
  finalizeUnusedStatementsBeforeClosing: false,
} as const;
