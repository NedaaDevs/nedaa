import { Platform } from "react-native";
import { areLiveActivitiesEnabled } from "expo-alarm";

import { PlatformType, type PlatformTypeValue } from "@/enums/app";
import { canRing, readAlarmPermissions } from "@/utils/alarmPermissions";

jest.mock("expo-modules-core", () => ({
  ...jest.requireActual("expo-modules-core"),
  requireOptionalNativeModule: () => ({
    isAlarmKitAvailable: jest.fn().mockResolvedValue(true),
    getAuthorizationStatus: jest.fn().mockResolvedValue("authorized"),
    areLiveActivitiesEnabled: jest.fn().mockRejectedValue(new Error("native failure")),
  }),
}));

// Makes Platform.select pick the branch of the given OS, as the real one does.
const onPlatform = (os: PlatformTypeValue) => {
  jest.replaceProperty(Platform, "OS", os);
  jest
    .spyOn(Platform, "select")
    .mockImplementation((spec: Record<string, unknown>) => (os in spec ? spec[os] : spec.default));
};

afterEach(() => jest.restoreAllMocks());

describe("Live Activities check that throws", () => {
  it("reports Live Activities off on iOS, so the alarm cannot ring", async () => {
    onPlatform(PlatformType.IOS);

    expect(await areLiveActivitiesEnabled()).toBe(false);
    expect(canRing(await readAlarmPermissions())).toBe(false);
  });

  it("reports Live Activities on elsewhere, where nothing depends on them", async () => {
    onPlatform(PlatformType.ANDROID);

    expect(await areLiveActivitiesEnabled()).toBe(true);
  });
});
