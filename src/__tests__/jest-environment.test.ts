import { isRunningInExpoGo } from "expo";

// The app ships as a development or store build, so Jest reads as one too.
it("does not run as Expo Go", () => {
  expect(isRunningInExpoGo()).toBe(false);
});

it("loads expo-notifications without its Expo Go warning", () => {
  const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  try {
    jest.isolateModules(() => {
      jest.requireActual("expo-notifications");
    });
    expect(warn.mock.calls.flat().join(" ")).not.toMatch(/Expo Go/);
  } finally {
    warn.mockRestore();
  }
});
