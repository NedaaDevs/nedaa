const { withNativeWind } = require("nativewind/metro");
const { getSentryExpoConfig } = require("@sentry/react-native/metro");
const { wrapWithReanimatedMetroConfig } = require("react-native-reanimated/metro-config");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getSentryExpoConfig(__dirname);

const configWithMinifier = {
  ...config,
  transformer: {
    ...config.transformer,
    minifierPath: "metro-minify-terser",
    minifierConfig: {
      compress: {
        drop_console: true,
        pure_funcs: ["console.log", "console.info", "console.debug"],
        warnings: false,
        passes: 2,
      },
      format: {
        comments: false,
      },
    },
  },
};

module.exports = withNativeWind(wrapWithReanimatedMetroConfig(configWithMinifier), {
  input: "./assets/global.css",
});
