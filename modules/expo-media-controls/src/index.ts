import { requireOptionalNativeModule, EventEmitter, type Subscription } from "expo-modules-core";

const NativeModule = requireOptionalNativeModule("ExpoMediaControls");
const emitter = NativeModule ? new EventEmitter(NativeModule) : null;

export function enable(): void {
  NativeModule?.enable();
}

export function disable(): void {
  NativeModule?.disable();
}

export function onRemoteNext(listener: () => void): Subscription {
  if (!emitter) {
    return { remove: () => {} } as Subscription;
  }
  return emitter.addListener("onRemoteNext", listener);
}

export function onRemotePrevious(listener: () => void): Subscription {
  if (!emitter) {
    return { remove: () => {} } as Subscription;
  }
  return emitter.addListener("onRemotePrevious", listener);
}
