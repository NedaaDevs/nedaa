/* global jest */
// The Tamagui animation driver reaches moti -> reanimated -> react-native-worklets,
// whose native module is absent under jest. Tests assert layout and accessibility,
// not motion, so the driver is stubbed rather than the whole chain mocked.
jest.mock("@tamagui/animations-moti", () => ({
  createAnimations: (animations) => animations,
}));
