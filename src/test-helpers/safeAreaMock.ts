/** Safe-area context with zero insets, for tests without its provider. */
module.exports = {
  ...jest.requireActual("react-native-safe-area-context"),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
};
