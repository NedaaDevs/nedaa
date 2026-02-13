const { getSentryExpoConfig } = require("@sentry/react-native/metro");
const { wrapWithReanimatedMetroConfig } = require("react-native-reanimated/metro-config");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getSentryExpoConfig(__dirname);

// For expo-drizzle-studio-plugin to work(allow us to view sqlite db)
// config.resolver.assetExts.push("wasm");
// config.server.enhanceMiddleware = (middleware) => {
//   return (req, res, next) => {
//     res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
//     res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
//     middleware(req, res, next);
//   };
// };

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

module.exports = wrapWithReanimatedMetroConfig(configWithMinifier);
