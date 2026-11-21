// The "locales" in app.json hold iOS Info.plist strings; on Android they become translated strings with no
// default value, which the release lint check rejects (ExtraTranslation). They are unused on Android.
const { withAppBuildGradle } = require("expo/config-plugins");

module.exports = function withAndroidLintTranslations(config) {
  return withAppBuildGradle(config, (c) => {
    if (!c.modResults.contents.includes('disable "ExtraTranslation"')) {
      c.modResults.contents = c.modResults.contents.replace(/android\s*\{/, (m) => `${m}\n    lint {\n        disable "ExtraTranslation", "MissingTranslation"\n    }`);
    }
    return c;
  });
};
