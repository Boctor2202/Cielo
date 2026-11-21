// The Android-only plugins must not change the runtime fingerprint: they change no native iOS code, so published
// iOS builds keep receiving updates.
const PLUGINS = ["./plugins/withAndroidLintTranslations", "./plugins/withAndroidGoogleMaps"];

/** @type {import('@expo/fingerprint').Config} */
module.exports = {
  ignorePaths: PLUGINS.map((p) => `${p.slice(2)}.js`),
  fileHookTransform: (source, chunk) => {
    if (source.type === "contents" && source.id === "expoConfig" && typeof chunk === "string" && PLUGINS.some((p) => chunk.includes(p))) {
      try {
        const cfg = JSON.parse(chunk);
        if (Array.isArray(cfg.plugins)) cfg.plugins = cfg.plugins.filter((p) => !PLUGINS.includes(p));
        return JSON.stringify(cfg);
      } catch {
        return chunk;
      }
    }
    return chunk;
  },
};
