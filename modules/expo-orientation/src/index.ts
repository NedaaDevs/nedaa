import {
  requireOptionalNativeModule,
  EventEmitter,
  type EventSubscription,
} from "expo-modules-core";
import type { OrientationData } from "./ExpoOrientation.types";

export type { OrientationData, OrientationSource } from "./ExpoOrientation.types";

const NativeModule = requireOptionalNativeModule("ExpoOrientation");
const emitter = NativeModule ? new EventEmitter(NativeModule) : null;

const noop = { remove() {} } as EventSubscription;

export const ExpoOrientationModule = {
  isAvailable: NativeModule !== null,
  startWatching(): void {
    NativeModule?.startWatching();
  },
  stopWatching(): void {
    NativeModule?.stopWatching();
  },
  addListener(eventName: string, listener: (event: OrientationData) => void): EventSubscription {
    if (!emitter) return noop;
    return (emitter as any).addListener(eventName, listener);
  },
};
