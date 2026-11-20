// Android-only settings applied at Android build time, so that the iOS fingerprint (runtime of the
// published iOS builds) is not changed by them.
module.exports = ({ config }) => {
  if (process.env.EAS_BUILD_PLATFORM !== "android") return config;
  const android = { ...config.android };
  android.permissions = (android.permissions ?? []).filter((p) => !/EXACT_ALARM/.test(p));
  android.blockedPermissions = ["android.permission.SCHEDULE_EXACT_ALARM", "android.permission.USE_EXACT_ALARM", "android.permission.RECORD_AUDIO"];
  return { ...config, android };
};
