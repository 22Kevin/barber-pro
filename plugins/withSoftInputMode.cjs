// plugins/withSoftInputMode.cjs
const { withAndroidManifest } = require("@expo/config-plugins");

module.exports = function withSoftInputMode(config) {
  return withAndroidManifest(config, (config) => {
    const mainActivity = config.modResults.manifest.application?.[0]?.activity?.find(
      (a) => a.$?.["android:name"] === ".MainActivity"
    );
    if (mainActivity) {
      mainActivity.$["android:windowSoftInputMode"] = "adjustResize";
    }
    return config;
  });
};
