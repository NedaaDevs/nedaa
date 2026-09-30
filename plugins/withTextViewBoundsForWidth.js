const { AndroidConfig, withAndroidStyles } = require("@expo/config-plugins");

const { assignStylesValue, getAppThemeGroup } = AndroidConfig.Styles;

// Parent is what AppCompat's theme already resolves textViewStyle to.
const TEXT_VIEW_STYLE = { name: "AppTextView", parent: "Widget.AppCompat.TextView" };

// RN measures text by advances; from API 35 a TextView breaks lines by ink
// bounds unless its style sets this, so a measured word can wrap or clip.
const applyTextViewBounds = (xml) =>
  assignStylesValue(
    assignStylesValue(xml, {
      add: true,
      name: "android:useBoundsForWidth",
      value: "false",
      targetApi: "35",
      parent: TEXT_VIEW_STYLE,
    }),
    {
      add: true,
      name: "android:textViewStyle",
      value: `@style/${TEXT_VIEW_STYLE.name}`,
      parent: getAppThemeGroup(),
    }
  );

const withTextViewBoundsForWidth = (config) =>
  withAndroidStyles(config, (config) => {
    config.modResults = applyTextViewBounds(config.modResults);
    return config;
  });

module.exports = withTextViewBoundsForWidth;
module.exports.applyTextViewBounds = applyTextViewBounds;
