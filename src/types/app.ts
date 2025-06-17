import { AppDirection, AppLocale, AppMode } from "@/enums/app";

export type AppState = {
  isFirstRun: boolean;
  locale: AppLocale;
  direction: AppDirection;
  mode: AppMode;
  sendCrashLogs: boolean;
  loadingMessage: string;
  showLoadingOverlay: boolean;
  setLoadingState: (loading: boolean, message?: string) => void;
  setIsFirstRun: (status: boolean) => void;
  setLocale: (lang: AppLocale) => void;
  setMode: (mode: AppMode) => void;
  setSendCrashLogs: (value: boolean) => void;
};
