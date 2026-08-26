const bundleId = "com.usebarberpro.app";
const appScheme = "usebarberpro";

const env = {
  appName: "Barber Pro",
  appSlug: "barber_app",
  scheme: appScheme,
  iosBundleId: bundleId,
  androidPackage: bundleId,
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "",
  googleAndroidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? "398675034994-221cpiiammapce83jsp0iskibgjufrb0.apps.googleusercontent.com",
  googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "",
  googleIosUrlScheme: process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME ?? "",
};

const googleSignInPlugin = env.googleIosUrlScheme
  ? [["@react-native-google-signin/google-signin", { iosUrlScheme: env.googleIosUrlScheme }]]
  : [];

/** @type {import('expo/config').ExpoConfig} */
const config = {
  name: env.appName,
  slug: env.appSlug,
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: env.scheme,
  userInterfaceStyle: "automatic",
  newArchEnabled: false,
  extra: {
    eas: {
      projectId: "ab25da37-3652-4059-83d1-feae8b011dc8",
    },
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: env.iosBundleId,
  },
  androidStatusBar: {
    backgroundColor: "#0A0A0A",
    barStyle: "light-content",
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#0A0A0A",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    navigationBarColor: "#0A0A0A",
    statusBarColor: "#0A0A0A",
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    package: env.androidPackage,
    versionCode: 13,
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
    name: "Barber Pro",
    shortName: "Barber Pro",
    description: "Sistema completo de gestão para barbearias.",
    themeColor: "#C9A84C",
    backgroundColor: "#0A0A0A",
    lang: "pt-BR",
    scope: "/",
    startUrl: "/",
    display: "standalone",
    orientation: "portrait",
  },
  plugins: [
    "expo-router",
    [
      "expo-location",
      {
        locationWhenInUsePermission: "Permitir que o Barber Pro acesse sua localização para encontrar barbearias próximas.",
      },
    ],
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
    [
      "expo-image-picker",
      {
        photosPermission: "Permitir que o Barber Pro acesse suas fotos para adicionar imagens aos produtos.",
        cameraPermission: "Permitir que o Barber Pro use a câmera para fotografar produtos.",
      },
    ],
    ["expo-build-properties", { android: { buildArchs: ["armeabi-v7a", "arm64-v8a"], kotlinVersion: "2.0.21" } }],
    ...googleSignInPlugin,
  ],
  experiments: { typedRoutes: true, reactCompiler: false },
};

module.exports = config;
