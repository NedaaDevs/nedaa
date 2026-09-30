import { appVersion, appVersionLabel } from "@/utils/appVersion";

jest.mock("expo-application", () => ({
  nativeApplicationVersion: "2.10.8",
  nativeBuildVersion: "546",
}));

describe("appVersion", () => {
  it("names the release the store shows", () => {
    expect(appVersion()).toBe("2.10.8");
  });

  // The label is the release plus its build, so one release's builds differ.
  it("labels the release with its build", () => {
    expect(appVersionLabel()).toBe("2.10.8 (546)");
  });
});
