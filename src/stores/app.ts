import { create } from "zustand";
import Storage from "expo-sqlite/kv-store";

import { createJSONStorage, devtools, persist, subscribeWithSelector } from "zustand/middleware";
import { getLocales } from "expo-localization";

import i18n from "@/localization/i18n";

// Enums
import { AppLocale, AppDirection, AppMode } from "@/enums/app";

// Constants
import { RTL_LOCALES } from "@/constants/Locales";
import { isOnboardingStepId } from "@/constants/Onboarding";
import { ALL_WHATS_NEW_IDS } from "@/constants/WhatsNew";
import { UPGRADE_PATH_STATE, isUpgradePathState } from "@/constants/UpgradePath";

// Types
import { AppState } from "@/types/app";

const getInitialLanguage = (): AppLocale => {
  // Get device locale (first two characters "en")
  const deviceLanguage = getLocales()[0]?.languageCode?.toLowerCase().slice(0, 2);

  // Check if device locale is supported in our AppLocale enum
  const isSupported = Object.values(AppLocale).includes(deviceLanguage as AppLocale);

  // Return device locale if supported, otherwise default to EN
  return isSupported ? (deviceLanguage as AppLocale) : AppLocale.EN;
};

export const getDirection = (locale: AppLocale): AppDirection => {
  return RTL_LOCALES.includes(locale as (typeof RTL_LOCALES)[number])
    ? AppDirection.RTL
    : AppDirection.LTR;
};

export const isRTL = (direction: AppDirection) => direction === AppDirection.RTL;

// Lazy import: widgetPayloads.ts pulls in hijri-native/expo-sqlite, which
// would otherwise load on every app-store import (incl. unrelated tests).
const syncWidgetPayloads = () => {
  void import("@/services/widgetPayloads").then((m) => m.syncWidgetPayloads());
};

const initialLanguage = getInitialLanguage();
const initialDirection = getDirection(initialLanguage);

export const useAppStore = create<AppState>()(
  devtools(
    subscribeWithSelector(
      persist(
        (set) => ({
          isFirstRun: true,
          onboardingStep: null,
          hasHydrated: false,
          locale: initialLanguage,
          mode: AppMode.SYSTEM,
          direction: initialDirection,
          hijriDaysOffset: 0,
          dismissedFeatureCards: [],
          upgradePath: UPGRADE_PATH_STATE.PENDING,
          upgradeShownThisLaunch: false,

          setIsFirstRun(isFirstRun: boolean) {
            // Completing first-run seeds every current feature card as dismissed:
            // discovery cards announce features to EXISTING users, so a fresh
            // install never starts with an announcement backlog.
            set((state) => ({
              isFirstRun,
              onboardingStep: isFirstRun ? state.onboardingStep : null,
              // Onboarding already walks every V3 choice, so the path closes.
              upgradePath: isFirstRun ? state.upgradePath : UPGRADE_PATH_STATE.DONE,
              dismissedFeatureCards: isFirstRun
                ? state.dismissedFeatureCards
                : [...new Set([...state.dismissedFeatureCards, ...ALL_WHATS_NEW_IDS])],
            }));
          },

          setOnboardingStep: (onboardingStep) => set({ onboardingStep }),

          setUpgradePath: (upgradePath) => set({ upgradePath }),

          markUpgradeShown: () => set({ upgradeShownThisLaunch: true }),

          // One write, so no state holds a first run with a stale saved step.
          restartOnboarding: () => set({ isFirstRun: true, onboardingStep: null }),

          setLocale: (locale: AppLocale) => {
            i18n.changeLanguage(locale);
            set({ locale });
            void syncWidgetPayloads();
          },

          setMode: (mode: AppMode) => {
            set({ mode });
          },

          setHijirOffset: (daysOffset) => {
            set({ hijriDaysOffset: daysOffset });
            void syncWidgetPayloads();
          },

          dismissFeatureCards: (ids: string[]) => {
            set((state) => ({
              dismissedFeatureCards: [...new Set([...state.dismissedFeatureCards, ...ids])],
            }));
          },
        }),
        {
          name: "app-storage",
          storage: createJSONStorage(() => Storage),
          partialize: (state) => ({
            isFirstRun: state.isFirstRun,
            onboardingStep: state.onboardingStep,
            locale: state.locale,
            mode: state.mode,
            direction: state.direction,
            dismissedFeatureCards: state.dismissedFeatureCards,
            hijriDaysOffset: state.hijriDaysOffset,
            upgradePath: state.upgradePath,
          }),
          merge: (persisted, current) => {
            const saved = (persisted ?? {}) as Partial<AppState>;
            // A missing saved step keeps the current one; an unknown one is dropped.
            const onboardingStep =
              saved.onboardingStep === undefined || isOnboardingStepId(saved.onboardingStep)
                ? (saved.onboardingStep ?? current.onboardingStep)
                : null;
            // A missing or unknown saved state opens the path.
            const upgradePath = isUpgradePathState(saved.upgradePath)
              ? saved.upgradePath
              : UPGRADE_PATH_STATE.PENDING;
            return { ...current, ...saved, onboardingStep, upgradePath };
          },
          onRehydrateStorage: () => (state, error) => {
            if (error) {
              console.error("[AppStore] Rehydration error:", error);
            }
            if (state?.locale) {
              i18n.changeLanguage(state.locale);
            }
            useAppStore.setState({ hasHydrated: true });
          },
        }
      )
    )
  )
);

export default useAppStore;
