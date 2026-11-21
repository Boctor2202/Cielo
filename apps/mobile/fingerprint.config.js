// The Android-only lint plugin must not change the runtime fingerprint (it changes no native iOS code and
// nothing the app runs on Android either), so published builds keep receiving updates.
const PLUGIN = "./plugins/withAndroidLintTranslations";

/** @type {import('@expo/fingerprint').Config} */
module.exports = {
  ignorePaths: ["plugins/withAndroidLintTranslations.js"],
  fileHookTransform: (source, chunk) => {
    if (source.type === "contents" && source.id === "expoConfig" && typeof chunk === "string" && chunk.includes(PLUGIN)) {
      try {
        const cfg = JSON.parse(chunk);
        if (Array.isArray(cfg.plugins)) cfg.plugins = cfg.plugins.filter((p) => p !== PLUGIN);
        return JSON.stringify(cfg);
      } catch {
        return chunk;
      }
    }
    return chunk;
  },
};
