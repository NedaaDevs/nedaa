import { AppDirection, AppLocale, AppMode } from "@/enums/app";

export type AppState = {
  isFirstRun: boolean;
  hasHydrated: boolean;
  locale: AppLocale;
  direction: AppDirection;
  mode: AppMode;
  hijriDaysOffset: number;
  setIsFirstRun: (status: boolean) => void;
  setLocale: (lang: AppLocale) => void;
  setMode: (mode: AppMode) => void;
  setHijirOffset: (offset: number) => void;
  dismissedFeatureCards: string[];
  dismissFeatureCards: (ids: string[]) => void;
};
