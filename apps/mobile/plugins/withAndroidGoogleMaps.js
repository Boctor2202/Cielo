// react-native-maps draws with Google Maps on Android, which needs an API key in the manifest (iOS uses Apple
// Maps, no key). The key comes from the EAS environment variable GOOGLE_MAPS_ANDROID_API_KEY at build time, so
// it is never committed. Restrict it in Google Cloud to the Maps SDK for Android, package app.geardown.logbook.
const { AndroidConfig, withAndroidManifest } = require("expo/config-plugins");

const NAME = "com.google.android.geo.API_KEY";

module.exports = function withAndroidGoogleMaps(config) {
  return withAndroidManifest(config, (c) => {
    const key = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
    if (!key) {
      console.warn("[withAndroidGoogleMaps] GOOGLE_MAPS_ANDROID_API_KEY is not set: maps will be blank on Android.");
      return c;
    }
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(c.modResults);
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(app, NAME, key);
    return c;
  });
};
