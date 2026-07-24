import {
  CompassNorthReference,
  CompassReliabilityIssue,
  CompassSensorReliability,
} from "@/enums/compass";
import {
  INVALID_HEADING_ERROR_DEGREES,
  MAX_BEARING_ERROR_DEGREES,
  MAX_HEADING_FUTURE_SKEW_MS,
  MAX_HEADING_ERROR_DEGREES,
  MAX_SAVED_LOCATION_AGE_MS,
  canProvideAlignmentFeedback,
  calculateBearingUncertaintyDegrees,
  calculateQiblaDirection,
  getCompassLocationAge,
  getCompassSensorReliability,
  getHeadingReliabilityIssue,
  getLocationReliabilityIssue,
  getNativeCompassReliabilityIssue,
  getQiblaProximityState,
  unwrapHeading,
  applyDeclinationCorrection,
  applyHeadingDeadband,
  getCalibrationOverlayVisible,
  getTiltOverlayVisible,
  getTurnDirection,
} from "@/utils/compass";

const NOW = 1_750_000_000_000;

describe("compass reliability", () => {
  it.each([
    ["Riyadh", 24.7136, 46.6753, 243.8],
    ["London", 51.5074, -0.1278, 119.0],
    ["New York", 40.7128, -74.006, 58.5],
    ["Jakarta", -6.2088, 106.8456, 295.2],
  ])("calculates the true Qibla bearing from %s", (_city, latitude, longitude, expected) => {
    expect(calculateQiblaDirection(latitude, longitude)).toBeCloseTo(expected, 1);
  });

  it("unwraps north crossings along the shortest arc", () => {
    const forward = [358, 359, 0, 1].reduce(unwrapHeading);
    const reverse = [1, 0, 359, 358].reduce(unwrapHeading);

    expect(forward).toBe(361);
    expect(reverse).toBe(-2);
  });

  it("allows a trustworthy magnetic sample for compass-only mode", () => {
    const issue = getHeadingReliabilityIssue(
      {
        heading: 127,
        accuracyDegrees: 8,
        isValid: true,
        northReference: CompassNorthReference.MAGNETIC,
        timestamp: NOW - 100,
      },
      { now: NOW, requiresTrueNorth: false }
    );

    expect(issue).toBeNull();
  });

  it("treats unavailable heading accuracy as terminal", () => {
    expect(getNativeCompassReliabilityIssue("heading_accuracy_unavailable")).toBe(
      CompassReliabilityIssue.SENSOR_ACCURACY_UNAVAILABLE
    );
  });

  it("maps a genuinely unreliable sensor to the uncalibrated issue", () => {
    expect(getNativeCompassReliabilityIssue("sensor_unreliable")).toBe(
      CompassReliabilityIssue.SENSOR_UNCALIBRATED
    );
  });

  it("requires true north before showing a Qibla result", () => {
    const issue = getHeadingReliabilityIssue(
      {
        heading: 127,
        accuracyDegrees: 8,
        isValid: true,
        northReference: CompassNorthReference.MAGNETIC,
        timestamp: NOW - 100,
      },
      { now: NOW, requiresTrueNorth: true }
    );

    expect(issue).toBe(CompassReliabilityIssue.TRUE_NORTH_UNAVAILABLE);
  });

  it("accepts a computed true-north heading for the Qibla result", () => {
    const issue = getHeadingReliabilityIssue(
      {
        heading: 127,
        accuracyDegrees: 8,
        isValid: true,
        northReference: CompassNorthReference.TRUE_COMPUTED,
        timestamp: NOW - 100,
      },
      { now: NOW, requiresTrueNorth: true }
    );

    expect(issue).toBeNull();
  });

  describe("applyDeclinationCorrection", () => {
    it("rotates a magnetic heading to computed true north", () => {
      const result = applyDeclinationCorrection(127, CompassNorthReference.MAGNETIC, 3.5);

      expect(result.northReference).toBe(CompassNorthReference.TRUE_COMPUTED);
      expect(result.heading).toBeCloseTo(130.5, 6);
    });

    it("normalizes a correction that crosses north", () => {
      const wrapForward = applyDeclinationCorrection(359, CompassNorthReference.MAGNETIC, 4);
      const wrapBackward = applyDeclinationCorrection(2, CompassNorthReference.MAGNETIC, -5);

      expect(wrapForward.heading).toBeCloseTo(3, 6);
      expect(wrapBackward.heading).toBeCloseTo(357, 6);
    });

    it("leaves a magnetic heading untouched when declination is unavailable", () => {
      const result = applyDeclinationCorrection(127, CompassNorthReference.MAGNETIC, null);

      expect(result.northReference).toBe(CompassNorthReference.MAGNETIC);
      expect(result.heading).toBe(127);
    });

    it("never overrides a native true-north heading", () => {
      const result = applyDeclinationCorrection(127, CompassNorthReference.TRUE, 3.5);

      expect(result.northReference).toBe(CompassNorthReference.TRUE);
      expect(result.heading).toBe(127);
    });

    it("does not synthesize true north from an unknown reference", () => {
      const result = applyDeclinationCorrection(127, CompassNorthReference.UNKNOWN, 3.5);

      expect(result.northReference).toBe(CompassNorthReference.UNKNOWN);
      expect(result.heading).toBe(127);
    });
  });

  it.each([
    ["invalid", false, 8, NOW - 100, CompassReliabilityIssue.SENSOR_INVALID],
    [
      "excessive error",
      true,
      MAX_HEADING_ERROR_DEGREES + 0.1,
      NOW - 100,
      CompassReliabilityIssue.SENSOR_UNCALIBRATED,
    ],
    ["stale", true, 8, NOW - 10_000, CompassReliabilityIssue.SENSOR_STALE],
    [
      "future-dated",
      true,
      8,
      NOW + MAX_HEADING_FUTURE_SKEW_MS + 1,
      CompassReliabilityIssue.SENSOR_INVALID,
    ],
  ])("fails closed for a %s heading", (_name, isValid, accuracyDegrees, timestamp, expected) => {
    expect(
      getHeadingReliabilityIssue(
        {
          heading: 127,
          accuracyDegrees,
          isValid,
          northReference: CompassNorthReference.TRUE,
          timestamp,
        },
        { now: NOW, requiresTrueNorth: true }
      )
    ).toBe(expected);
  });

  it("accepts a heading whose error the platform cannot bound", () => {
    // Android reports values[4] as -1 when the HAL cannot estimate heading error. The heading
    // stays usable so the direction is shown; alignment claims are withheld separately.
    expect(
      getHeadingReliabilityIssue(
        {
          heading: 127,
          accuracyDegrees: null,
          isValid: true,
          northReference: CompassNorthReference.TRUE,
          timestamp: NOW - 100,
        },
        { now: NOW, requiresTrueNorth: true }
      )
    ).toBeNull();
  });

  it("withholds alignment feedback when the heading error is unbounded", () => {
    expect(canProvideAlignmentFeedback(null, 1)).toBe(false);
  });

  it("rejects a location whose uncertainty makes the nearby Qibla bearing unsafe", () => {
    const issue = getLocationReliabilityIssue(
      {
        latitude: 21.422487,
        longitude: 39.8272,
        accuracyMeters: 20,
        altitude: 0,
        timestamp: NOW - 100,
      },
      { now: NOW, isSaved: false }
    );

    expect(issue).toBe(CompassReliabilityIssue.LOCATION_TOO_INACCURATE);
  });

  it("accepts the same location accuracy when angular uncertainty is small", () => {
    const issue = getLocationReliabilityIssue(
      {
        latitude: 24.7136,
        longitude: 46.6753,
        accuracyMeters: 20,
        altitude: 0,
        timestamp: NOW - 100,
      },
      { now: NOW, isSaved: false }
    );

    expect(issue).toBeNull();
    expect(calculateBearingUncertaintyDegrees(20, 790_000)).toBeLessThan(MAX_BEARING_ERROR_DEGREES);
  });

  it("expires saved locations instead of silently trusting stale coordinates", () => {
    const issue = getLocationReliabilityIssue(
      {
        latitude: 24.7136,
        longitude: 46.6753,
        accuracyMeters: 20,
        altitude: 0,
        timestamp: NOW - MAX_SAVED_LOCATION_AGE_MS - 1,
      },
      { now: NOW, isSaved: true }
    );

    expect(issue).toBe(CompassReliabilityIssue.LOCATION_STALE);
  });

  it("allows alignment feedback only when combined uncertainty is trustworthy", () => {
    expect(canProvideAlignmentFeedback(6, 2)).toBe(true);
    expect(canProvideAlignmentFeedback(null, 2)).toBe(false);
    expect(canProvideAlignmentFeedback(20, 2)).toBe(false);
    expect(canProvideAlignmentFeedback(10, 6)).toBe(false);
  });

  it.each([
    ["just now", NOW, { unit: "now", value: 0 }],
    ["one minute", NOW - 60_000, { unit: "minutes", value: 1 }],
    ["one hour", NOW - 60 * 60_000, { unit: "hours", value: 1 }],
    ["twenty-four hours", NOW - 24 * 60 * 60_000, { unit: "hours", value: 24 }],
  ])("formats saved-location age at the %s boundary", (_label, timestamp, expected) => {
    expect(getCompassLocationAge(timestamp, NOW)).toEqual(expected);
  });

  it.each([
    [8, CompassSensorReliability.GOOD],
    [20, CompassSensorReliability.FAIR],
    [45, CompassSensorReliability.NEEDS_CALIBRATION],
    [null, CompassSensorReliability.UNKNOWN],
    // The fused orientation provider reports 180 when it cannot bound the error at all,
    // which is an absent estimate rather than a wide one.
    [INVALID_HEADING_ERROR_DEGREES, CompassSensorReliability.UNKNOWN],
    [200, CompassSensorReliability.UNKNOWN],
  ])("maps %s° uncertainty to %s reliability", (accuracy, expected) => {
    expect(getCompassSensorReliability(accuracy)).toBe(expected);
  });

  it("enters alignment at five degrees", () => {
    expect(getQiblaProximityState(5, 0, "searching")).toBe("aligned");
  });

  it("keeps alignment through threshold jitter until the heading exits eight degrees", () => {
    const headings = [5, 5.5, 4.9, 5.2, 4.8, 8, 8.1, 4.9];
    const states = headings.reduce<("searching" | "approaching" | "aligned")[]>(
      (result, heading) => [
        ...result,
        getQiblaProximityState(heading, 0, result.at(-1) ?? "searching"),
      ],
      []
    );

    expect(states).toEqual([
      "aligned",
      "aligned",
      "aligned",
      "aligned",
      "aligned",
      "aligned",
      "approaching",
      "aligned",
    ]);
  });
});

describe("applyHeadingDeadband", () => {
  it("keeps the displayed heading for sub-deadband changes", () => {
    expect(applyHeadingDeadband(100, 100.5)).toBe(100);
  });

  it("passes changes larger than the deadband through", () => {
    expect(applyHeadingDeadband(100, 101.2)).toBe(101.2);
  });

  it("measures the change across the 0/360 wrap", () => {
    expect(applyHeadingDeadband(359.9, 0.3)).toBe(359.9);
    expect(applyHeadingDeadband(359.0, 0.3)).toBe(0.3);
  });
});

describe("getTurnDirection", () => {
  it("returns null when within the aligned threshold", () => {
    expect(getTurnDirection(100, 103)).toBeNull();
  });

  it("returns right when the qibla is clockwise from the heading", () => {
    expect(getTurnDirection(100, 150)).toBe("right");
  });

  it("returns left when the qibla is counter-clockwise from the heading", () => {
    expect(getTurnDirection(100, 40)).toBe("left");
  });

  it("takes the shortest arc across north", () => {
    expect(getTurnDirection(350, 20)).toBe("right");
    expect(getTurnDirection(20, 350)).toBe("left");
  });
});

describe("getCalibrationOverlayVisible", () => {
  it("shows on the native unreliable flag regardless of accuracy", () => {
    expect(getCalibrationOverlayVisible(10, true, false)).toBe(true);
  });

  it("shows when heading error reaches the enter threshold", () => {
    expect(getCalibrationOverlayVisible(45, false, false)).toBe(true);
  });

  it("stays hidden below the enter threshold", () => {
    expect(getCalibrationOverlayVisible(44, false, false)).toBe(false);
  });

  it("stays visible until error drops to the exit threshold", () => {
    expect(getCalibrationOverlayVisible(40, false, true)).toBe(true);
    expect(getCalibrationOverlayVisible(35, false, true)).toBe(false);
  });

  it("treats unknown accuracy as not-bad", () => {
    expect(getCalibrationOverlayVisible(null, false, false)).toBe(false);
    expect(getCalibrationOverlayVisible(null, false, true)).toBe(false);
  });
});

describe("getTiltOverlayVisible", () => {
  it("never shows without tilt data", () => {
    expect(getTiltOverlayVisible(null, false)).toBe(false);
    expect(getTiltOverlayVisible(null, true)).toBe(false);
  });

  it("enters above 25 degrees and exits below 20", () => {
    expect(getTiltOverlayVisible(26, false)).toBe(true);
    expect(getTiltOverlayVisible(24, false)).toBe(false);
    expect(getTiltOverlayVisible(22, true)).toBe(true);
    expect(getTiltOverlayVisible(19, true)).toBe(false);
  });
});
