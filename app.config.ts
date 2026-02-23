// Load environment variables with proper priority (system > .env)
import "./scripts/load-env.js";
import type { ExpoConfig } from "expo/config";

const bundleId = "space.manus.barber.pro.t20260223005104";
const timestamp = bundleId.split(".").pop()?.replace(/^t/, "") ?? "";
const schemeFromBundleId = `manus${timestamp}`;

const env = {
  appName: "Barber Pro",
  appSlug: "barber_app",
  logoUrl: "https://private-us-east-1.manuscdn.com/sessionFile/4hYWl403sUWuLZe3Q6D4lv/sandbox/2FSZI6NQh6VJ6weakU9Y4V-img-1_1771809092000_na1fn_YmFyYmVyLXByby1pY29u.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvNGhZV2w0MDNzVVd1TFplM1E2RDRsdi9zYW5kYm94LzJGU1pJNk5RaDZWSjZ3ZWFrVTlZNFYtaW1nLTFfMTc3MTgwOTA5MjAwMF9uYTFmbl9ZbUZ5WW1WeUxYQnlieTFwWTI5dS5wbmc~eC1vc3MtcHJvY2Vzcz1pbWFnZS9yZXNpemUsd18xOTIwLGhfMTkyMC9mb3JtYXQsd2VicC9xdWFsaXR5LHFfODAiLCJDb25kaXRpb24iOnsiRGF0ZUxlc3NUaGFuIjp7IkFXUzpFcG9jaFRpbWUiOjE3OTg3NjE2MDB9fX1dfQ__&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=Q-XgQbNGEI1qVs7kCGj3OFimcmdIOiwBhxtFial3D~H6r6C24ss~nqqEbXknudyic3WyA9wlxeB7ii6n4BN15SQTWhUSz3GRudXc5eTTOr7XKvdPUIBh-tF-4bHefbY~zRQAo7DaUCZUEVTazdUKc2PxEttPR5wBEMxumoXbx3E1tL1CFnXI7yVijqR9ivw6AzH63CKdaLNgpOab9mcVyzPSt5Fs3DrF8xD5ypZQAmHCyiVAgVnQ0w95EunQdoGf~yXZZXm5lwe-mNlSguDUH82n6SI3QbcxdyHybyR-iD8w6AYcq51C3TxfI8xSDvln75PFmFpTwPjHhNMpJZDfHg__",
  scheme: schemeFromBundleId,
  iosBundleId: bundleId,
  androidPackage: bundleId,
};

const config: ExpoConfig = {
  name: env.appName,
  slug: env.appSlug,
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: env.scheme,
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: env.iosBundleId,
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#0A0A0A",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    package: env.androidPackage,
    permissions: ["POST_NOTIFICATIONS"],
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [{ scheme: env.scheme, host: "*" }],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    ["expo-audio", { microphonePermission: "Allow $(PRODUCT_NAME) to access your microphone." }],
    ["expo-video", { supportsBackgroundPlayback: true, supportsPictureInPicture: true }],
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#0A0A0A",
        dark: { backgroundColor: "#0A0A0A" },
      },
    ],
    ["expo-build-properties", { android: { buildArchs: ["armeabi-v7a", "arm64-v8a"] } }],
  ],
  experiments: { typedRoutes: true, reactCompiler: true },
};

export default config;
