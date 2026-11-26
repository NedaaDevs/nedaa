import type { ReactNode } from "react";
import { act, render } from "@testing-library/react-native";
import * as SplashScreen from "expo-splash-screen";

import RootLayout from "@/app/_layout";
import { rootScreenLayout } from "@/components/navigation/screen-edge";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { ONBOARDING_PATH, type OnboardingPath } from "@/constants/Onboarding";
import { useAppStore } from "@/stores/app";
import { SAFE_EDGE } from "@/utils/safeArea";

const passThrough = ({ children }: { children?: ReactNode }) => children;

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("expo-splash-screen", () => ({
  setOptions: jest.fn(),
  preventAutoHideAsync: jest.fn(),
  hideAsync: jest.fn(),
}));
let mockSegments: string[] = [];
jest.mock("expo-router", () => {
  const Screen = () => null;
  const Stack = Object.assign(
    ({ screenLayout }: { screenLayout?: unknown }) => {
      mockSeen.screenLayout = screenLayout;
      return null;
    },
    { Screen }
  );
  return { Stack, useSegments: () => mockSegments };
});
jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  SafeAreaView: ({ edges, children }: { edges?: unknown; children?: ReactNode }) => {
    mockSeen.edges = edges;
    return children;
  },
}));
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
let mockAlertLaunch = false;
jest.mock("@/hooks/useOnboardingPath", () => ({
  useOnboardingPath: () => ({ path: mockPath, alertLaunch: mockAlertLaunch }),
}));

/** What each wired part was last handed. */
const mockSeen: {
  gatePath?: unknown;
  canNavigate?: boolean;
  alertLaunch?: boolean;
  screenLayout?: unknown;
  edges?: unknown;
} = {};
jest.mock("@/hooks/useNotificationResponses", () => ({
  useNotificationResponses: (canNavigate: boolean) => {
    mockSeen.canNavigate = canNavigate;
  },
}));
jest.mock("@/components/onboarding/flow/OnboardingGate", () => ({
  OnboardingGate: ({ path, children }: { path: unknown; children?: ReactNode }) => {
    mockSeen.gatePath = path;
    // The app under the gate reads the launch's alert latch.
    const { use } = jest.requireActual("react");
    const { AlertLaunchContext } = jest.requireActual("@/contexts/AlertLaunchContext");
    mockSeen.alertLaunch = use(AlertLaunchContext);
    return children;
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
  mockAlertLaunch = false;
  mockSegments = [];
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

  it("opens taps while the upgrade path shows", async () => {
    mockPath = ONBOARDING_PATH.UPGRADE;
    await renderRoot();

    expect(mockSeen.gatePath).toBe(ONBOARDING_PATH.UPGRADE);
    expect(mockSeen.canNavigate).toBe(true);
  });

  it("holds taps during the first run", async () => {
    mockPath = ONBOARDING_PATH.FIRST_RUN;
    await renderRoot();

    expect(mockSeen.gatePath).toBe(ONBOARDING_PATH.FIRST_RUN);
    expect(mockSeen.canNavigate).toBe(false);
  });

  it.each([true, false])("hands the app the launch's alert latch (%s)", async (latched) => {
    mockAlertLaunch = latched;
    await renderRoot();

    expect(mockSeen.alertLaunch).toBe(latched);
  });

  it("shows the app with no path", async () => {
    await renderRoot();

    expect(mockSeen.gatePath).toBeNull();
    expect(mockSeen.canNavigate).toBe(true);
  });
});

// Each screen pads its own top, so the frame never flips mid-transition.
describe("RootLayout frame", () => {
  it("hands the stack each screen's top edge", async () => {
    await renderRoot();

    expect(mockSeen.screenLayout).toBe(rootScreenLayout);
  });

  it.each([
    ["a sky screen", BACK_DESTINATION.SETTINGS_ABOUT.route],
    ["a padded screen", BACK_DESTINATION.SETTINGS_ACKNOWLEDGEMENTS.route],
  ])("pads the sides and leaves the top to %s", async (_name, route) => {
    mockSegments = route.split("/");
    await renderRoot();

    expect(mockSeen.edges).toEqual(expect.arrayContaining([SAFE_EDGE.RIGHT, SAFE_EDGE.LEFT]));
    expect(mockSeen.edges).not.toContain(SAFE_EDGE.TOP);
  });
});
