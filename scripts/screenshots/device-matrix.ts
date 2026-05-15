// scripts/screenshots/device-matrix.ts
export type DeviceSpec = {
  id: "iphone-6.9" | "iphone-6.5" | "ipad-13" | "android-phone";
  platform: "ios" | "android";
  width: number;
  height: number;
  framePath: string;
  capturedRawWidth: number;
  capturedRawHeight: number;
  supportsWidgets: boolean;
};

export const DEVICE_MATRIX: readonly DeviceSpec[] = [
  {
    id: "iphone-6.9",
    platform: "ios",
    width: 1290,
    height: 2796,
    framePath: "frames/iphone-6.9.svg",
    capturedRawWidth: 1290,
    capturedRawHeight: 2796,
    supportsWidgets: true,
  },
  {
    id: "iphone-6.5",
    platform: "ios",
    width: 1242,
    height: 2688,
    framePath: "frames/iphone-6.5.svg",
    capturedRawWidth: 1242,
    capturedRawHeight: 2688,
    supportsWidgets: true,
  },
  {
    id: "ipad-13",
    platform: "ios",
    width: 2064,
    height: 2752,
    framePath: "frames/ipad-13.svg",
    capturedRawWidth: 2064,
    capturedRawHeight: 2752,
    supportsWidgets: false,
  },
  {
    id: "android-phone",
    platform: "android",
    width: 1080,
    height: 1920,
    framePath: "frames/android-phone.svg",
    capturedRawWidth: 1080,
    capturedRawHeight: 1920,
    supportsWidgets: false,
  },
] as const;
