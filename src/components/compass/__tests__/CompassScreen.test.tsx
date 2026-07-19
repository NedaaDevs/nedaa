import React from "react";
import { AccessibilityInfo } from "react-native";
import renderer, { act } from "react-test-renderer";

import {
  CompassLocationPermissionAccuracy,
  CompassLocationPreference,
  CompassLocationSource,
  CompassNorthReference,
  CompassReliabilityIssue,
} from "@/enums/compass";
import { LocalPermissionStatus } from "@/enums/location";
import type { CompassData } from "@/hooks/useCompass";
import type { CompassLocationResult } from "@/hooks/useCompassLocation";
import type { CompassLocationFix } from "@/types/compass";
import { calculateQiblaDirection } from "@/utils/compass";

import CompassScreen from "@/app/(tabs)/compass";

const mockCompassDial = jest.fn<null, [Record<string, unknown>]>(() => null);
const mockCompassInfoCard = jest.fn<null, [Record<string, unknown>]>(() => null);
const mockCompassIssueCard = jest.fn<null, [Record<string, unknown>]>(() => null);
const mockUseCompass = jest.fn<CompassData, [unknown]>();
const mockUseCompassLocation = jest.fn<CompassLocationResult, [unknown]>();
const mockHapticSelection = jest.fn();
const mockHapticMedium = jest.fn();

jest.mock("expo-router/react-navigation", () => ({
  useIsFocused: () => true,
}));

jest.mock("lucide-react-native", () => ({
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
jest.mock("@/components/compass/CompassInfoCard", () => ({
  CompassInfoCard: (props: Record<string, unknown>) => mockCompassInfoCard(props),
}));
jest.mock("@/components/compass/CompassIssueCard", () => ({
  CompassIssueCard: (props: Record<string, unknown>) => mockCompassIssueCard(props),
}));
jest.mock("@/components/compass/CompassModeSwitch", () => ({
  CompassModeSwitch: () => null,
}));
jest.mock("@/components/compass/CompassSetupCard", () => ({
  CompassSetupCard: () => null,
}));
jest.mock("@/components/ui/background", () => ({
  Background: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));
jest.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children?: React.ReactNode }) => children ?? null,
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
jest.mock("@/hooks/useHaptic", () => ({
  useHaptic: (kind: string) => (kind === "medium" ? mockHapticMedium : mockHapticSelection),
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
};

const locationResult = (overrides: Partial<CompassLocationResult> = {}): CompassLocationResult => ({
  preference: CompassLocationPreference.QIBLA,
  fix: savedFix,
  source: CompassLocationSource.SAVED,
  issue: null,
  permissionStatus: LocalPermissionStatus.GRANTED,
  permissionAccuracy: CompassLocationPermissionAccuracy.PRECISE,
  canAskAgain: true,
  needsSettings: false,
  isRefreshing: false,
  chooseQibla: jest.fn(async () => undefined),
  chooseCompassOnly: jest.fn(),
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

  it("shows Qibla from a verified saved fix in compass-only mode without acquiring a location", async () => {
    mockUseCompassLocation.mockReturnValue(
      locationResult({ preference: CompassLocationPreference.COMPASS_ONLY })
    );

    const tree = await renderScreen();
    const compassOptions = mockUseCompass.mock.calls[0][0];
    const dialProps = mockCompassDial.mock.calls[0]?.[0];
    const infoProps = mockCompassInfoCard.mock.calls[0]?.[0];
    act(() => tree.unmount());

    expect(mockUseCompassLocation).toHaveBeenCalledWith({ active: true });
    expect(compassOptions).toEqual(expect.objectContaining({ paused: false, location: savedFix }));
    expect(mockCompassDial).toHaveBeenCalledTimes(1);
    expect(dialProps).toEqual(
      expect.objectContaining({
        qiblaDirection: expect.closeTo(calculateQiblaDirection(24.7136, 46.6753), 5),
      })
    );
    expect(infoProps).toEqual(
      expect.objectContaining({
        isSavedLocation: true,
        qiblaDirectionText: "244°",
        sensorAccuracyText: "±8°",
        sensorReliabilityText: "compass.sensorReliability.good",
      })
    );
  });

  it("keeps a magnetic compass-only heading usable while withholding Qibla", async () => {
    mockUseCompassLocation.mockReturnValue(
      locationResult({ preference: CompassLocationPreference.COMPASS_ONLY })
    );
    mockUseCompass.mockReturnValue({
      ...reliableCompass,
      northReference: CompassNorthReference.MAGNETIC,
    });

    const tree = await renderScreen();
    const dialProps = mockCompassDial.mock.calls[0]?.[0];
    const infoProps = mockCompassInfoCard.mock.calls[0]?.[0];
    act(() => tree.unmount());

    expect(mockCompassIssueCard).not.toHaveBeenCalled();
    expect(mockCompassDial).toHaveBeenCalledTimes(1);
    expect(dialProps).toEqual(expect.objectContaining({ qiblaDirection: null }));
    expect(infoProps).toEqual(
      expect.objectContaining({
        qiblaDirectionText: null,
        distanceText: null,
        locationAccuracyText: null,
        isSavedLocation: false,
        northReferenceLabel: "compass.northReference.magnetic",
      })
    );
    expect(mockHapticMedium).not.toHaveBeenCalled();
  });

  it("still blocks Qibla mode outright when true north is unavailable", async () => {
    mockUseCompass.mockReturnValue({
      ...reliableCompass,
      northReference: CompassNorthReference.MAGNETIC,
    });

    const tree = await renderScreen();
    const issueProps = mockCompassIssueCard.mock.calls[0]?.[0];
    act(() => tree.unmount());

    expect(mockCompassDial).not.toHaveBeenCalled();
    expect(mockCompassInfoCard).not.toHaveBeenCalled();
    expect(issueProps).toEqual(
      expect.objectContaining({
        title: `compass.issue.${CompassReliabilityIssue.TRUE_NORTH_UNAVAILABLE}.title`,
      })
    );
  });

  it("keeps the Qibla visual and numeric uncertainty visible while warning about calibration", async () => {
    mockUseCompass.mockReturnValue({
      ...reliableCompass,
      accuracyDegrees: 45,
    });

    const tree = await renderScreen();
    const dialProps = mockCompassDial.mock.calls[0]?.[0];
    const infoProps = mockCompassInfoCard.mock.calls[0]?.[0];
    const issueProps = mockCompassIssueCard.mock.calls[0]?.[0];
    act(() => tree.unmount());

    expect(mockCompassDial).toHaveBeenCalledTimes(1);
    expect(dialProps).toEqual(
      expect.objectContaining({
        qiblaDirection: expect.any(Number),
        proximityState: "searching",
      })
    );
    expect(infoProps).toEqual(
      expect.objectContaining({
        qiblaDirectionText: "244°",
        sensorAccuracyText: "±45°",
        sensorReliabilityText: "compass.sensorReliability.needsCalibration",
      })
    );
    expect(issueProps).toEqual(
      expect.objectContaining({
        title: "compass.issue.sensor_uncalibrated.title",
        body: "compass.issue.sensor_uncalibrated.body",
        action: "calibrate",
      })
    );
    expect(mockHapticMedium).not.toHaveBeenCalled();
  });

  it("blocks an unbounded heading without presenting null accuracy as zero degrees", async () => {
    mockUseCompass.mockReturnValue({
      ...reliableCompass,
      accuracyDegrees: null,
      error: "heading_accuracy_unavailable",
    });

    const tree = await renderScreen();
    const issueProps = mockCompassIssueCard.mock.calls[0]?.[0];
    act(() => tree.unmount());

    expect(mockCompassDial).not.toHaveBeenCalled();
    expect(mockCompassInfoCard).not.toHaveBeenCalled();
    expect(mockCompassInfoCard).not.toHaveBeenCalledWith(
      expect.objectContaining({ sensorAccuracyText: "±0°" })
    );
    expect(issueProps).toEqual(
      expect.objectContaining({
        title: `compass.issue.${CompassReliabilityIssue.SENSOR_ACCURACY_UNAVAILABLE}.title`,
        body: `compass.issue.${CompassReliabilityIssue.SENSOR_ACCURACY_UNAVAILABLE}.body`,
        action: null,
      })
    );
  });
});
