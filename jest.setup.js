/* global jest */
// The Tamagui animation driver reaches moti -> reanimated -> react-native-worklets,
// whose native module is absent under jest. Tests assert layout and accessibility,
// not motion, so the driver is stubbed rather than the whole chain mocked.
jest.mock("@tamagui/animations-moti", () => ({
  createAnimations: (animations) => animations,
}));

// The persisted stores write through expo-sqlite's kv-store, a native module absent
// under jest. A suite that needs stored values mocks it again in its own file.
jest.mock("expo-sqlite/kv-store", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
    // The debug-mode store reads synchronously, so it hydrates before a log line.
    getItemSync: jest.fn(() => null),
    setItemSync: jest.fn(),
    removeItemSync: jest.fn(),
  },
}));
