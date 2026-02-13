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
      "react-native-worklets/plugin",
    ],
  };
};
