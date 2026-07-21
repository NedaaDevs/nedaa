import {
  requireOptionalNativeModule,
  EventEmitter,
  type EventSubscription,
} from "expo-modules-core";
import type { OrientationData, OrientationStartOptions } from "./ExpoOrientation.types";

export type {
  OrientationData,
  OrientationNorthReference,
  OrientationSource,
  OrientationStartOptions,
} from "./ExpoOrientation.types";

const NativeModule = requireOptionalNativeModule("ExpoOrientation");
const emitter = NativeModule ? new EventEmitter(NativeModule) : null;

const noop = { remove() {} } as EventSubscription;

export const ExpoOrientationModule = {
  isAvailable: NativeModule !== null,
  /** Returns the platform's startup-decision summary for diagnostics, when it provides one. */
  startWatching(options: OrientationStartOptions = {}): string | null {
    const startupInfo = NativeModule?.startWatching(options);
    return typeof startupInfo === "string" ? startupInfo : null;
  },
  stopWatching(): void {
    NativeModule?.stopWatching();
  },
  addListener(eventName: string, listener: (event: OrientationData) => void): EventSubscription {
    if (!emitter) return noop;
    return (emitter as any).addListener(eventName, listener);
  },
};
