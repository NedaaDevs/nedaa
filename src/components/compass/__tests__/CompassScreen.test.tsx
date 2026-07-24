import React from "react";
import { AccessibilityInfo } from "react-native";
import renderer, { act } from "react-test-renderer";

import {
  CompassLocationPermissionAccuracy,
  CompassLocationSource,
  CompassNorthReference,
} from "@/enums/compass";
import { LocalPermissionStatus } from "@/enums/location";
import type { CompassData } from "@/hooks/useCompass";
import type { CompassLocationResult } from "@/hooks/useCompassLocation";
import type { CompassLocationFix } from "@/types/compass";
import { calculateQiblaDirection } from "@/utils/compass";

import CompassScreen from "@/app/(tabs)/compass";

const mockCompassDial = jest.fn<null, [Record<string, unknown>]>(() => null);
const mockCompassOverlay = jest.fn<null, [Record<string, unknown>]>(() => null);
const mockCompassIssueCard = jest.fn<null, [Record<string, unknown>]>(() => null);
const mockCompassDetailsSheet = jest.fn<null, [Record<string, unknown>]>(() => null);
const mockUseCompass = jest.fn<CompassData, [unknown]>();
const mockUseCompassLocation = jest.fn<CompassLocationResult, [unknown]>();
const mockHapticSelection = jest.fn();
const mockHapticLight = jest.fn();
const mockHapticMedium = jest.fn();

jest.mock("expo-router/react-navigation", () => ({
  useIsFocused: () => true,
}));

jest.mock("lucide-react-native", () => ({
  Info: "Info",
  LocateFixed: "LocateFixed",
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) => {
      if (key === "compass.accuracyDegrees") return `±${options?.degrees}°`;
      if (key === "compass.locationAccuracyMeters") return `±${options?.meters} m`;
      return key;
    },
  }),
}));

jest.mock("@/components/TopBar", () => () => null);
jest.mock("@/components/compass/CompassDial", () => ({
  CompassDial: (props: Record<string, unknown>) => mockCompassDial(props),
}));
jest.mock("@/components/compass/CompassOverlay", () => ({
  CompassOverlay: (props: Record<string, unknown>) => mockCompassOverlay(props),
}));
jest.mock("@/components/compass/CompassIssueCard", () => ({
  CompassIssueCard: (props: Record<string, unknown>) => mockCompassIssueCard(props),
}));
jest.mock("@/components/compass/CompassDetailsSheet", () => ({
  CompassDetailsSheet: (props: Record<string, unknown>) => mockCompassDetailsSheet(props),
}));
jest.mock("@/components/ui/background", () => ({
  Background: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));
jest.mock("@/components/ui/box", () => ({
  Box: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));
jest.mock("@/components/ui/hstack", () => ({
  HStack: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));
jest.mock("@/components/ui/icon", () => ({ Icon: () => null }));
jest.mock("@/components/ui/spinner", () => ({ Spinner: () => null }));
jest.mock("@/components/ui/text", () => ({
  Text: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));
jest.mock("@/components/ui/vstack", () => ({
  VStack: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));

jest.mock("@/hooks/useAppVisibility", () => ({
  useAppVisibility: () => ({ isActive: true }),
}));
jest.mock("@/hooks/useCompass", () => ({
  useCompass: (options: unknown) => mockUseCompass(options),
}));
jest.mock("@/hooks/useCompassLocation", () => ({
  useCompassLocation: (options: unknown) => mockUseCompassLocation(options),
}));
jest.mock("@/hooks/useDelayedFlag", () => ({
  useDelayedFlag: (value: boolean) => value,
}));
jest.mock("@/hooks/useHaptic", () => ({
  useHaptic: (kind: string) =>
    kind === "medium" ? mockHapticMedium : kind === "light" ? mockHapticLight : mockHapticSelection,
}));
jest.mock("@/screenshot-mode/useScreenshotSeed", () => ({
  useScreenshotSeed: () => null,
}));
jest.mock("@/utils/appLogger", () => ({
  AppLogger: {
    create: () => ({ d: jest.fn(), i: jest.fn(), w: jest.fn(), e: jest.fn() }),
  },
}));
jest.mock("@/utils/number", () => ({
  formatNumberToLocale: (value: string) => value,
}));

const NOW = 1_750_000_000_000;

const savedFix: CompassLocationFix = {
  latitude: 24.7136,
  longitude: 46.6753,
  accuracyMeters: 12,
  altitude: 610,
  timestamp: NOW - 60_000,
};

const reliableCompass: CompassData = {
  heading: 220,
  accuracyDegrees: 8,
  northReference: CompassNorthReference.TRUE,
  isAvailable: true,
  isActive: true,
  isValid: true,
  timestamp: NOW - 100,
  observedAt: NOW,
  source: "rotation_vector",
  error: null,
  tiltDegrees: null,
};

const locationResult = (overrides: Partial<CompassLocationResult> = {}): CompassLocationResult => ({
  fix: savedFix,
  source: CompassLocationSource.SAVED,
  issue: null,
  permissionStatus: LocalPermissionStatus.GRANTED,
  permissionAccuracy: CompassLocationPermissionAccuracy.PRECISE,
  canAskAgain: true,
  needsSettings: false,
  isRefreshing: false,
  refresh: jest.fn(async () => undefined),
  openSettings: jest.fn(async () => undefined),
  ...overrides,
});

const renderScreen = async () => {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<CompassScreen />);
    await Promise.resolve();
  });
  return tree;
};

const hasText = (tree: renderer.ReactTestRenderer, text: string) =>
  tree.root.findAll((node) => node.props.children === text).length > 0;

const rotateTo = async (tree: renderer.ReactTestRenderer, heading: number) => {
  mockUseCompass.mockReturnValue({ ...reliableCompass, heading });
  await act(async () => {
    tree.update(<CompassScreen />);
    await Promise.resolve();
  });
};

describe("CompassScreen Qibla reliability", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    jest.clearAllMocks();
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
    jest
      .spyOn(AccessibilityInfo, "addEventListener")
      .mockReturnValue({ remove: jest.fn() } as never);
    mockUseCompass.mockReturnValue(reliableCompass);
    mockUseCompassLocation.mockReturnValue(locationResult());
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("renders the dial with a Qibla direction when location and true-north heading exist", async () => {
    const tree = await renderScreen();
    const dialProps = mockCompassDial.mock.calls[0]?.[0];
    const hasEnableLocation = hasText(tree, "compass.enableLocation");
    act(() => tree.unmount());

    expect(mockCompassDial).toHaveBeenCalledTimes(1);
    expect(dialProps).toEqual(
      expect.objectContaining({
        qiblaDirection: expect.closeTo(calculateQiblaDirection(24.7136, 46.6753), 5),
      })
    );
    expect(hasEnableLocation).toBe(false);
  });

  it("falls back to a plain compass with an enable-location line when no fix exists", async () => {
    mockUseCompassLocation.mockReturnValue(
      locationResult({ fix: null, source: CompassLocationSource.NONE, issue: "location_required" })
    );
    mockUseCompass.mockReturnValue({
      ...reliableCompass,
      northReference: CompassNorthReference.MAGNETIC,
    });

    const tree = await renderScreen();
    const dialProps = mockCompassDial.mock.calls[0]?.[0];
    const hasEnableLocation = hasText(tree, "compass.enableLocation");
    act(() => tree.unmount());

    expect(dialProps).toEqual(expect.objectContaining({ qiblaDirection: null }));
    expect(hasEnableLocation).toBe(true);
  });

  it("requests location when the enable line is pressed", async () => {
    const refresh = jest.fn(async () => undefined);
    mockUseCompassLocation.mockReturnValue(
      locationResult({
        fix: null,
        source: CompassLocationSource.NONE,
        issue: "location_required",
        refresh,
      })
    );
    mockUseCompass.mockReturnValue({
      ...reliableCompass,
      northReference: CompassNorthReference.MAGNETIC,
    });

    const tree = await renderScreen();
    const [enableLocationButton] = tree.root.findAllByProps({
      accessibilityLabel: "a11y.compass.enableLocation",
    });
    await act(async () => {
      enableLocationButton.props.onPress();
    });
    act(() => tree.unmount());

    expect(refresh).toHaveBeenCalled();
  });

  it("shows the calibrate overlay instead of a card for unusable accuracy", async () => {
    mockUseCompass.mockReturnValue({
      ...reliableCompass,
      accuracyDegrees: 60,
    });

    const tree = await renderScreen();
    const overlayProps = mockCompassOverlay.mock.calls[0]?.[0];
    const dialProps = mockCompassDial.mock.calls[0]?.[0];
    act(() => tree.unmount());

    expect(mockCompassIssueCard).not.toHaveBeenCalled();
    expect(overlayProps).toEqual(expect.objectContaining({ variant: "calibrate" }));
    expect(dialProps).toEqual(expect.objectContaining({ dimmed: true }));
  });

  it("shows the hold-flat overlay when tilted", async () => {
    mockUseCompass.mockReturnValue({
      ...reliableCompass,
      tiltDegrees: 40,
    });

    const tree = await renderScreen();
    const overlayProps = mockCompassOverlay.mock.calls[0]?.[0];
    act(() => tree.unmount());

    expect(overlayProps).toEqual(expect.objectContaining({ variant: "holdFlat" }));
  });

  it("ticks as the dial passes a detent while searching for the Qibla", async () => {
    mockUseCompass.mockReturnValue({ ...reliableCompass, heading: 200 });
    const tree = await renderScreen();

    // 200° and 150° are both far from the ~244° Qibla, so the dial stays in the
    // searching zone and crossing the 45° detent boundary should tick.
    await rotateTo(tree, 150);
    act(() => tree.unmount());

    expect(mockHapticSelection).toHaveBeenCalled();
    expect(mockHapticLight).not.toHaveBeenCalled();
    expect(mockHapticMedium).not.toHaveBeenCalled();
  });

  it("escalates with a light approach cue and a medium lock at the Qibla", async () => {
    const qibla = calculateQiblaDirection(24.7136, 46.6753);
    mockUseCompass.mockReturnValue({ ...reliableCompass, heading: 200 });
    const tree = await renderScreen();

    await rotateTo(tree, qibla - 6);
    expect(mockHapticLight).toHaveBeenCalledTimes(1);
    expect(mockHapticMedium).not.toHaveBeenCalled();

    await rotateTo(tree, qibla);
    act(() => tree.unmount());

    expect(mockHapticMedium).toHaveBeenCalledTimes(1);
    // The approach and lock own the feel near the target; detents stay silent there.
    expect(mockHapticSelection).not.toHaveBeenCalled();
  });

  it("keeps a blocking card for a dead sensor", async () => {
    mockUseCompass.mockReturnValue({
      ...reliableCompass,
      isAvailable: false,
      error: "sensor_unavailable",
    });

    const tree = await renderScreen();
    const issueProps = mockCompassIssueCard.mock.calls[0]?.[0];
    act(() => tree.unmount());

    expect(mockCompassDial).not.toHaveBeenCalled();
    expect(issueProps).toEqual(
      expect.objectContaining({
        title: "compass.issue.sensor_unavailable.title",
        secondaryAction: null,
      })
    );
  });

  it("offers a compass-only escape hatch when true north is unavailable and honors it", async () => {
    mockUseCompass.mockReturnValue({
      ...reliableCompass,
      northReference: CompassNorthReference.MAGNETIC,
    });

    const tree = await renderScreen();
    const issueProps = mockCompassIssueCard.mock.calls[0]?.[0];

    expect(mockCompassDial).not.toHaveBeenCalled();
    expect(issueProps).toEqual(
      expect.objectContaining({
        title: "compass.issue.true_north_unavailable.title",
        secondaryAction: "compassOnly",
      })
    );

    await act(async () => {
      (issueProps?.onSecondaryAction as () => void)();
    });
    const dialProps = mockCompassDial.mock.calls[0]?.[0];
    act(() => tree.unmount());

    // Choosing compass-only relaxes the true-north gate: the magnetic dial renders
    // with no Qibla direction rather than staying blocked.
    expect(mockCompassDial).toHaveBeenCalled();
    expect(dialProps).toEqual(expect.objectContaining({ qiblaDirection: null }));
  });
});
