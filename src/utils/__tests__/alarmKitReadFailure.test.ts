import { Platform } from "react-native";

import { PlatformType } from "@/enums/app";
import { canRing, readAlarmPermissions } from "@/utils/alarmPermissions";

// The real shared AlarmKit read, over a native check that fails.
jest.mock("expo-modules-core", () => ({
  ...jest.requireActual("expo-modules-core"),
  requireOptionalNativeModule: () => ({
    isAlarmKitAvailable: jest.fn().mockRejectedValue(new Error("native failure")),
    getAuthorizationStatus: jest.fn().mockResolvedValue("authorized"),
    areLiveActivitiesEnabled: jest.fn().mockResolvedValue(true),
  }),
}));

afterEach(() => jest.restoreAllMocks());

describe("an AlarmKit availability check that throws", () => {
  it("counts AlarmKit as unavailable on iOS, so no alarm can ring", async () => {
    jest.replaceProperty(Platform, "OS", PlatformType.IOS);

    const permissions = await readAlarmPermissions();
    expect(permissions).toEqual([]);
    expect(canRing(permissions)).toBe(false);
  });
});
