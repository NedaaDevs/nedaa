// https://docs.expo.dev/guides/using-eslint/
module.exports = {
  extends: ["expo", "prettier"],
  plugins: ["prettier"],

  ignorePatterns: ["/dist/*"],
  env: {
    jest: true,
  },
};
