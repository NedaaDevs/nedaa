import { useCallback, useEffect, useRef, useState } from "react";
import { Linking, Platform } from "react-native";

import * as Location from "@/adapters/location";
import { PlatformType } from "@/enums/app";
import {
  CompassLocationPermissionAccuracy,
  CompassLocationSource,
  CompassReliabilityIssue,
  type CompassLocationPermissionAccuracyValue,
  type CompassLocationSourceValue,
  type CompassReliabilityIssueValue,
} from "@/enums/compass";
import { LocalPermissionStatus } from "@/enums/location";
import { useCompassStore } from "@/stores/compass";
import type { CompassLocationFix } from "@/types/compass";
import { AppLogger } from "@/utils/appLogger";
import {
  MAX_FRESH_LOCATION_AGE_MS,
  MAX_SAVED_LOCATION_AGE_MS,
  getLocationReliabilityIssue,
} from "@/utils/compass";

const log = AppLogger.create("compass");

export const COMPASS_LOCATION_REQUEST_TIMEOUT_MS = 15_000;
export const MAX_ACQUIRED_LOCATION_ACCURACY_METERS = 100;

type PermissionStatusValue = Location.LocationPermissionResponse["status"];

type LocationViewState = {
  fix: CompassLocationFix | null;
  source: CompassLocationSourceValue;
  issue: CompassReliabilityIssueValue | null;
  permissionStatus: PermissionStatusValue | null;
  permissionAccuracy: CompassLocationPermissionAccuracyValue;
  canAskAgain: boolean;
  needsSettings: boolean;
};

export type CompassLocationResult = LocationViewState & {
  isRefreshing: boolean;
  /** Explicit user action; the only path that may show the permission prompt. */
  refresh: () => Promise<void>;
  openSettings: () => Promise<void>;
};

type ActiveRequest = {
  id: number;
  promise: Promise<void>;
  cancel: () => void;
};

type UseCompassLocationOptions = {
  active?: boolean;
};

type CancellablePositionRequest = {
  promise: Promise<Location.LocationObject>;
  cancel: () => void;
};

class CompassLocationRequestCancelledError extends Error {}
class CompassLocationAccuracyError extends Error {}

const EMPTY_VIEW: LocationViewState = {
  fix: null,
  source: CompassLocationSource.NONE,
  issue: null,
  permissionStatus: null,
  permissionAccuracy: CompassLocationPermissionAccuracy.UNKNOWN,
  canAskAgain: true,
  needsSettings: false,
};

const getPermissionAccuracy = (
  response: Location.LocationPermissionResponse
): CompassLocationPermissionAccuracyValue => {
  if (response.ios?.accuracy === "reduced" || response.android?.accuracy === "coarse") {
    return CompassLocationPermissionAccuracy.REDUCED;
  }
  if (response.android?.accuracy === "none") {
    return CompassLocationPermissionAccuracy.REDUCED;
  }
  if (response.ios?.accuracy === "full" || response.android?.accuracy === "fine") {
    return CompassLocationPermissionAccuracy.PRECISE;
  }
  return CompassLocationPermissionAccuracy.UNKNOWN;
};

const getPermissionIssue = (
  response: Location.LocationPermissionResponse
): CompassReliabilityIssueValue => {
  if (response.status === LocalPermissionStatus.UNDETERMINED) {
    return CompassReliabilityIssue.LOCATION_REQUIRED;
  }
  return response.canAskAgain
    ? CompassReliabilityIssue.LOCATION_PERMISSION_DENIED
    : CompassReliabilityIssue.LOCATION_PERMISSION_BLOCKED;
};

const getPositionFailureIssue = (error: unknown): CompassReliabilityIssueValue => {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (message.includes("disabled") || message.includes("provider")) {
    return CompassReliabilityIssue.LOCATION_SERVICES_DISABLED;
  }
  return CompassReliabilityIssue.LOCATION_TIMEOUT;
};

const createPositionRequest = (
  mayShowUserSettingsDialog: boolean,
  isAcceptable: (location: Location.LocationObject) => boolean
): CancellablePositionRequest => {
  let subscription: Location.LocationSubscription | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let settled = false;
  let receivedLocation = false;
  let rejectPromise: ((reason: Error) => void) | null = null;

  const stopNativeWatch = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    subscription?.remove();
    subscription = null;
  };

  const promise = new Promise<Location.LocationObject>((resolve, reject) => {
    rejectPromise = reject;

    const rejectOnce = (error: Error) => {
      if (settled) return;
      settled = true;
      stopNativeWatch();
      reject(error);
    };

    const handleLocation = (location: Location.LocationObject) => {
      if (settled) return;
      receivedLocation = true;
      if (!isAcceptable(location)) return;
      settled = true;
      stopNativeWatch();
      resolve(location);
    };

    timer = setTimeout(
      () =>
        rejectOnce(
          receivedLocation
            ? new CompassLocationAccuracyError("Compass location remained too inaccurate")
            : new Error("Compass location request timed out")
        ),
      COMPASS_LOCATION_REQUEST_TIMEOUT_MS
    );

    void Location.watchPositionAsync(
      {
        accuracy: Location.LocationAccuracy.HIGH,
        mayShowUserSettingsDialog,
      },
      handleLocation,
      (reason) => rejectOnce(new Error(reason))
    )
      .then((nextSubscription) => {
        subscription = nextSubscription;
        if (settled) stopNativeWatch();
      })
      .catch((error) => {
        rejectOnce(error instanceof Error ? error : new Error(String(error)));
      });
  });

  return {
    promise,
    cancel: () => {
      if (settled) return;
      settled = true;
      stopNativeWatch();
      rejectPromise?.(
        new CompassLocationRequestCancelledError("Compass location request canceled")
      );
    },
  };
};

const toCompassLocationFix = (location: Location.LocationObject): CompassLocationFix | null => {
  const { latitude, longitude, accuracy, altitude } = location.coords;
  if (
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180 ||
    accuracy === null ||
    !Number.isFinite(accuracy) ||
    accuracy <= 0 ||
    accuracy > MAX_ACQUIRED_LOCATION_ACCURACY_METERS ||
    !Number.isFinite(location.timestamp) ||
    location.timestamp <= 0
  ) {
    return null;
  }

  return {
    latitude,
    longitude,
    accuracyMeters: accuracy,
    altitude: altitude !== null && Number.isFinite(altitude) ? altitude : null,
    timestamp: location.timestamp,
  };
};

const getInitialView = (): LocationViewState => {
  const { lastVerifiedFix } = useCompassStore.getState();
  if (!lastVerifiedFix) return EMPTY_VIEW;

  const issue = getLocationReliabilityIssue(lastVerifiedFix, { isSaved: true });
  if (issue) return { ...EMPTY_VIEW, issue };
  return {
    ...EMPTY_VIEW,
    fix: lastVerifiedFix,
    source: CompassLocationSource.SAVED,
  };
};

const getReliabilityCheckedView = (view: LocationViewState): LocationViewState => {
  if (!view.fix) return view;
  const now = Date.now();

  if (view.source === CompassLocationSource.FRESH) {
    const freshIssue = getLocationReliabilityIssue(view.fix, { isSaved: false, now });
    if (!freshIssue) return view;

    const savedIssue = getLocationReliabilityIssue(view.fix, { isSaved: true, now });
    if (!savedIssue) return { ...view, source: CompassLocationSource.SAVED };
    return {
      ...view,
      fix: null,
      source: CompassLocationSource.NONE,
      issue: savedIssue,
    };
  }

  const savedIssue = getLocationReliabilityIssue(view.fix, { isSaved: true, now });
  if (!savedIssue) return view;
  return {
    ...view,
    fix: null,
    source: CompassLocationSource.NONE,
    issue: savedIssue,
  };
};

export const useCompassLocation = ({
  active = true,
}: UseCompassLocationOptions = {}): CompassLocationResult => {
  const lastVerifiedFix = useCompassStore((state) => state.lastVerifiedFix);
  const setLastVerifiedFix = useCompassStore((state) => state.setLastVerifiedFix);
  const clearLastVerifiedFix = useCompassStore((state) => state.clearLastVerifiedFix);

  const [view, setView] = useState<LocationViewState>(getInitialView);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const viewRef = useRef(view);
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);
  const activeRequestRef = useRef<ActiveRequest | null>(null);

  const canApplyRequest = useCallback(
    (requestId: number) => mountedRef.current && requestIdRef.current === requestId,
    []
  );

  const fallbackToSaved = useCallback(
    (
      requestId: number,
      issue: CompassReliabilityIssueValue,
      permission: Location.LocationPermissionResponse | null,
      permissionAccuracy: CompassLocationPermissionAccuracyValue = CompassLocationPermissionAccuracy.UNKNOWN,
      needsSettings = false
    ) => {
      if (!canApplyRequest(requestId)) return;

      const savedFix = useCompassStore.getState().lastVerifiedFix;
      const savedIssue = savedFix
        ? getLocationReliabilityIssue(savedFix, { isSaved: true })
        : CompassReliabilityIssue.LOCATION_REQUIRED;
      const canUseSaved = savedFix !== null && savedIssue === null;

      log.w(
        "Location",
        `fresh fix unavailable issue=${issue} fallback=${canUseSaved ? "saved" : "none"}`
      );
      setView({
        fix: canUseSaved ? savedFix : null,
        source: canUseSaved ? CompassLocationSource.SAVED : CompassLocationSource.NONE,
        issue,
        permissionStatus: permission?.status ?? null,
        permissionAccuracy,
        canAskAgain: permission?.canAskAgain ?? true,
        needsSettings,
      });
    },
    [canApplyRequest]
  );

  const performRefresh = useCallback(
    (allowPermissionPrompt: boolean): Promise<void> => {
      const activeRequest = activeRequestRef.current;
      if (activeRequest) return activeRequest.promise;

      const requestId = ++requestIdRef.current;
      if (mountedRef.current) setIsRefreshing(true);

      let positionRequest: CancellablePositionRequest | null = null;
      let cancellationRequested = false;
      const cancel = () => {
        cancellationRequested = true;
        positionRequest?.cancel();
      };

      const promise = (async () => {
        let permission: Location.LocationPermissionResponse;
        try {
          permission = await Location.getForegroundPermissionsAsync();
          if (!permission.granted && allowPermissionPrompt && permission.canAskAgain) {
            log.i("Permission", "requesting foreground location after explicit user action");
            permission = await Location.requestForegroundPermissionsAsync();
          }
        } catch {
          fallbackToSaved(requestId, CompassReliabilityIssue.LOCATION_PERMISSION_DENIED, null);
          return;
        }

        if (cancellationRequested || !canApplyRequest(requestId)) return;

        const permissionAccuracy = getPermissionAccuracy(permission);
        log.i(
          "Permission",
          `status=${permission.status} accuracy=${permissionAccuracy} canAskAgain=${permission.canAskAgain}`
        );

        if (!permission.granted) {
          const issue = getPermissionIssue(permission);
          fallbackToSaved(
            requestId,
            issue,
            permission,
            permissionAccuracy,
            issue === CompassReliabilityIssue.LOCATION_PERMISSION_BLOCKED
          );
          return;
        }

        if (permissionAccuracy !== CompassLocationPermissionAccuracy.PRECISE) {
          fallbackToSaved(
            requestId,
            CompassReliabilityIssue.LOCATION_REDUCED_ACCURACY,
            permission,
            permissionAccuracy,
            true
          );
          return;
        }

        let servicesEnabled: boolean;
        try {
          servicesEnabled = await Location.hasServicesEnabledAsync();
        } catch {
          servicesEnabled = false;
        }
        if (cancellationRequested || !canApplyRequest(requestId)) return;
        if (!servicesEnabled) {
          fallbackToSaved(
            requestId,
            CompassReliabilityIssue.LOCATION_SERVICES_DISABLED,
            permission,
            permissionAccuracy,
            true
          );
          return;
        }

        log.i("Location", "requesting one foreground high-accuracy fix");
        let location: Location.LocationObject;
        positionRequest = createPositionRequest(allowPermissionPrompt, (candidate) => {
          const candidateFix = toCompassLocationFix(candidate);
          return (
            candidateFix !== null &&
            getLocationReliabilityIssue(candidateFix, { isSaved: false }) === null
          );
        });
        if (cancellationRequested || !canApplyRequest(requestId)) {
          positionRequest.cancel();
          return;
        }
        try {
          location = await positionRequest.promise;
        } catch (error) {
          if (error instanceof CompassLocationRequestCancelledError) return;
          const issue =
            error instanceof CompassLocationAccuracyError
              ? CompassReliabilityIssue.LOCATION_TOO_INACCURATE
              : getPositionFailureIssue(error);
          fallbackToSaved(
            requestId,
            issue,
            permission,
            permissionAccuracy,
            issue === CompassReliabilityIssue.LOCATION_SERVICES_DISABLED
          );
          return;
        }

        const fix = toCompassLocationFix(location);
        const issue = fix ? getLocationReliabilityIssue(fix, { isSaved: false }) : null;
        if (!fix || issue) {
          fallbackToSaved(
            requestId,
            issue ?? CompassReliabilityIssue.LOCATION_TOO_INACCURATE,
            permission,
            permissionAccuracy
          );
          return;
        }

        if (!canApplyRequest(requestId)) return;
        setLastVerifiedFix(fix);
        log.i("Location", `accepted fresh fix accuracyMeters=${Math.round(fix.accuracyMeters)}`);
        setView({
          fix,
          source: CompassLocationSource.FRESH,
          issue: null,
          permissionStatus: permission.status,
          permissionAccuracy,
          canAskAgain: permission.canAskAgain,
          needsSettings: false,
        });
      })().finally(() => {
        if (activeRequestRef.current?.id === requestId) {
          activeRequestRef.current = null;
          if (canApplyRequest(requestId)) setIsRefreshing(false);
        }
      });

      activeRequestRef.current = { id: requestId, promise, cancel };
      return promise;
    },
    [canApplyRequest, fallbackToSaved, setLastVerifiedFix]
  );

  const invalidateRequests = useCallback(() => {
    activeRequestRef.current?.cancel();
    requestIdRef.current += 1;
    activeRequestRef.current = null;
    if (mountedRef.current) setIsRefreshing(false);
  }, []);

  const refresh = useCallback(async () => {
    await performRefresh(true);
  }, [performRefresh]);

  const openSettings = useCallback(async () => {
    if (
      Platform.OS === PlatformType.ANDROID &&
      viewRef.current.issue === CompassReliabilityIssue.LOCATION_SERVICES_DISABLED
    ) {
      log.i("Permission", "opening Android location services after user action");
      await Linking.sendIntent("android.settings.LOCATION_SOURCE_SETTINGS");
      return;
    }

    log.i("Permission", "opening app settings after user action");
    await Linking.openSettings();
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      activeRequestRef.current?.cancel();
      requestIdRef.current += 1;
      activeRequestRef.current = null;
    };
  }, []);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    if (!lastVerifiedFix) return;
    const issue = getLocationReliabilityIssue(lastVerifiedFix, { isSaved: true });
    if (!issue) {
      if (viewRef.current.fix === null) {
        setView({
          ...EMPTY_VIEW,
          fix: lastVerifiedFix,
          source: CompassLocationSource.SAVED,
        });
      }
      return;
    }

    log.w("Location", `stored fix removed issue=${issue}`);
    clearLastVerifiedFix();
  }, [clearLastVerifiedFix, lastVerifiedFix]);

  useEffect(() => {
    if (!active) {
      invalidateRequests();
      return;
    }

    const currentView = viewRef.current;
    const hasFreshFix =
      currentView.source === CompassLocationSource.FRESH &&
      currentView.fix !== null &&
      getLocationReliabilityIssue(currentView.fix, { isSaved: false }) === null;
    if (hasFreshFix) return;

    void performRefresh(false);
  }, [active, invalidateRequests, performRefresh]);

  useEffect(() => {
    if (!view.fix) return;

    const fix = view.fix;
    const source = view.source;
    const maxAge =
      source === CompassLocationSource.FRESH
        ? MAX_FRESH_LOCATION_AGE_MS
        : MAX_SAVED_LOCATION_AGE_MS;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const scheduleExpiry = () => {
      const delay = Math.max(1, fix.timestamp + maxAge - Date.now() + 1);
      timer = setTimeout(() => {
        if (cancelled || !mountedRef.current || viewRef.current.fix !== fix) return;

        if (Date.now() - fix.timestamp <= maxAge) {
          scheduleExpiry();
          return;
        }

        if (source === CompassLocationSource.FRESH) {
          log.i("Location", "fresh fix aged into saved fallback");
          setView((current) =>
            current.fix === fix
              ? {
                  ...current,
                  source: CompassLocationSource.SAVED,
                }
              : current
          );
          return;
        }

        log.w("Location", "saved fix expired and was removed");
        if (useCompassStore.getState().lastVerifiedFix === fix) clearLastVerifiedFix();
        setView((current) =>
          current.fix === fix
            ? {
                ...current,
                fix: null,
                source: CompassLocationSource.NONE,
                issue: CompassReliabilityIssue.LOCATION_STALE,
              }
            : current
        );
      }, delay);
    };

    scheduleExpiry();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [clearLastVerifiedFix, view.fix, view.source]);

  const exposedView = getReliabilityCheckedView(view);

  return {
    ...exposedView,
    isRefreshing,
    refresh,
    openSettings,
  };
};
