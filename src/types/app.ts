import { AppDirection, AppLocale, AppMode } from "@/enums/app";

export type AppState = {
  isFirstRun: boolean;
  hasHydrated: boolean;
  locale: AppLocale;
  direction: AppDirection;
  mode: AppMode;
  loadingMessage: string;
  showLoadingOverlay: boolean;
  hijriDaysOffset: number;
  setLoadingState: (loading: boolean, message?: string) => void;
  setIsFirstRun: (status: boolean) => void;
  setLocale: (lang: AppLocale) => void;
  setMode: (mode: AppMode) => void;
  setHijirOffset: (offset: number) => void;
  dismissedFeatureCards: string[];
  dismissFeatureCard: (id: string) => void;
  // TODO(quran-gate): remove at 2.10.0
  quranUnlocked: boolean;
  // TODO(quran-gate): remove at 2.10.0
  setQuranUnlocked: (on: boolean) => void;
};
