import type { ReactNode } from "react";
import { act, render } from "@testing-library/react-native";
import * as SplashScreen from "expo-splash-screen";

import RootLayout from "@/app/_layout";
import { ONBOARDING_PATH, type OnboardingPath } from "@/constants/Onboarding";
import { useAppStore } from "@/stores/app";

const passThrough = ({ children }: { children?: ReactNode }) => children;

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("expo-splash-screen", () => ({
  setOptions: jest.fn(),
  preventAutoHideAsync: jest.fn(),
  hideAsync: jest.fn(),
}));
jest.mock("expo-router", () => {
  const Screen = () => null;
  const Stack = Object.assign(() => null, { Screen });
  return { Stack, useSegments: () => [] };
});
jest.mock("@/tasks/backgroundRefresh", () => ({}));
jest.mock("@/config/fonts", () => ({ useLoadFonts: () => [true, null] }));
jest.mock("@/hooks/usePreferencesHydrated", () => ({ usePreferencesHydrated: () => true }));
jest.mock("@/hooks/useInitialSetup", () => ({ useInitialSetup: jest.fn() }));
jest.mock("@/hooks/useNotificationListeners", () => ({ useNotificationListeners: jest.fn() }));
jest.mock("@/hooks/useAlarmDeepLink", () => ({ useAlarmDeepLink: jest.fn() }));
jest.mock("@/utils/reviewPrompt", () => ({ trackAppSession: jest.fn() }));
jest.mock("@/utils/devMenu", () => ({ registerDevMenu: jest.fn() }));
jest.mock("@/screenshot-mode/router", () => ({ installScreenshotRouter: () => undefined }));
jest.mock("@/contexts/PhaseContext", () => ({
  ...jest.requireActual("@/contexts/PhaseContext"),
  usePrayerPhaseSource: () => undefined,
}));
jest.mock("@/components/ToastHost", () => ({ ToastHost: () => null }));
jest.mock("@/components/athkar/PlayerBottomSheet", () => () => null);
jest.mock("@/components/CrashReportPrompt", () => () => null);
jest.mock("@/components/WhatsNewSheet", () => () => null);
jest.mock("@gorhom/bottom-sheet", () => ({ BottomSheetModalProvider: passThrough }));

const mockLaunch = { ready: true, launchedByAlert: false };
jest.mock("@/hooks/useLaunchSource", () => ({ useLaunchSource: () => mockLaunch }));
let mockPath: OnboardingPath | null = null;
jest.mock("@/hooks/useOnboardingPath", () => ({ useOnboardingPath: () => mockPath }));

/** What each wired part was last handed. */
const mockSeen: { sheetOnboarding?: boolean; gatePath?: unknown; canNavigate?: boolean } = {};
jest.mock("@/hooks/useNotificationResponses", () => ({
  useNotificationResponses: (canNavigate: boolean) => {
    mockSeen.canNavigate = canNavigate;
  },
}));
jest.mock("@/components/location/CityChangeSheet", () => ({
  CityChangeSheet: ({ onboarding }: { onboarding: boolean }) => {
    mockSeen.sheetOnboarding = onboarding;
    return null;
  },
}));
jest.mock("@/components/onboarding/flow/OnboardingGate", () => ({
  OnboardingGate: ({ path }: { path: unknown }) => {
    mockSeen.gatePath = path;
    return null;
  },
}));

const renderRoot = async () => {
  const view = await render(<RootLayout />);
  await act(async () => undefined);
  return view;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockLaunch.ready = true;
  mockLaunch.launchedByAlert = false;
  mockPath = null;
  for (const key of Object.keys(mockSeen)) delete mockSeen[key as keyof typeof mockSeen];
  useAppStore.setState({ hasHydrated: true });
});

describe("RootLayout wiring", () => {
  it("holds the splash until the launch source is read", async () => {
    mockLaunch.ready = false;
    const view = await renderRoot();

    expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
    expect(mockSeen.gatePath).toBeUndefined();

    mockLaunch.ready = true;
    await view.rerender(<RootLayout />);
    await act(async () => undefined);

    expect(SplashScreen.hideAsync).toHaveBeenCalled();
  });

  it("hides the city sheet and opens taps while the upgrade path shows", async () => {
    mockPath = ONBOARDING_PATH.UPGRADE;
    await renderRoot();

    expect(mockSeen.gatePath).toBe(ONBOARDING_PATH.UPGRADE);
    expect(mockSeen.sheetOnboarding).toBe(true);
    expect(mockSeen.canNavigate).toBe(true);
  });

  it("holds taps during the first run", async () => {
    mockPath = ONBOARDING_PATH.FIRST_RUN;
    await renderRoot();

    expect(mockSeen.gatePath).toBe(ONBOARDING_PATH.FIRST_RUN);
    expect(mockSeen.sheetOnboarding).toBe(true);
    expect(mockSeen.canNavigate).toBe(false);
  });

  it("shows the app with no path", async () => {
    await renderRoot();

    expect(mockSeen.gatePath).toBeNull();
    expect(mockSeen.sheetOnboarding).toBe(false);
    expect(mockSeen.canNavigate).toBe(true);
  });
});
