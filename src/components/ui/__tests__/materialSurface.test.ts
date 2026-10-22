import { chooseMaterialSurface, MATERIAL_SURFACE } from "@/components/ui/material/surface";
import { PlatformType } from "@/enums/app";

const IOS = {
  platform: PlatformType.IOS,
  apiLevel: 0,
  reduceTransparency: false,
  hasBlurTarget: false,
};
const ANDROID = {
  platform: PlatformType.ANDROID,
  apiLevel: 34,
  reduceTransparency: false,
  hasBlurTarget: true,
};

describe("chooseMaterialSurface", () => {
  it("blurs on iOS", () => {
    expect(chooseMaterialSurface(IOS)).toBe(MATERIAL_SURFACE.BLUR);
  });

  it("is opaque on iOS under Reduce Transparency", () => {
    expect(chooseMaterialSurface({ ...IOS, reduceTransparency: true })).toBe(
      MATERIAL_SURFACE.OPAQUE
    );
  });

  it("blurs on Android 31 with a blur target", () => {
    expect(chooseMaterialSurface({ ...ANDROID, apiLevel: 31 })).toBe(MATERIAL_SURFACE.BLUR);
  });

  it("is opaque on Android 30", () => {
    expect(chooseMaterialSurface({ ...ANDROID, apiLevel: 30 })).toBe(MATERIAL_SURFACE.OPAQUE);
  });

  it("is opaque on Android without a blur target", () => {
    expect(chooseMaterialSurface({ ...ANDROID, hasBlurTarget: false })).toBe(
      MATERIAL_SURFACE.OPAQUE
    );
  });

  it("is opaque on Android under Reduce Transparency", () => {
    expect(chooseMaterialSurface({ ...ANDROID, reduceTransparency: true })).toBe(
      MATERIAL_SURFACE.OPAQUE
    );
  });
});
