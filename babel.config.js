module.exports = function (api) {
  api.cache.using(() => process.env.NODE_ENV);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      [
        "@tamagui/babel-plugin",
        {
          components: ["tamagui"],
          config: "./tamagui.config.ts",
          disableExtraction: process.env.NODE_ENV === "development",
        },
      ],
      // Jest maps the lucide barrel to one CommonJS file; only bundles split it.
      ...(process.env.NODE_ENV === "test" ? [] : ["./scripts/babel/lucideDirectImports"]),
      "react-native-worklets/plugin",
    ],
  };
};
