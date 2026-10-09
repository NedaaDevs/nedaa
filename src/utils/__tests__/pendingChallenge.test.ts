import { getPendingChallenge } from "expo-alarm";

// Both native stores record the fire time in seconds since the epoch.
const FIRED_AT_SECONDS = 1_791_500_000;

jest.mock("expo-modules-core", () => ({
  ...jest.requireActual("expo-modules-core"),
  requireOptionalNativeModule: () => ({
    getPendingChallenge: () =>
      Promise.resolve({
        alarmId: "a",
        alarmType: "fajr",
        title: "Fajr",
        timestamp: FIRED_AT_SECONDS,
      }),
  }),
  EventEmitter: jest.fn(),
}));

describe("getPendingChallenge", () => {
  it("returns the fire time in milliseconds, as Date expects", async () => {
    const pending = await getPendingChallenge();

    expect(pending?.timestamp).toBe(FIRED_AT_SECONDS * 1000);
  });
});
