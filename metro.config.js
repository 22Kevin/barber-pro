import { createRequire } from "module";
const require = createRequire(import.meta.url);

const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(new URL(".", import.meta.url).pathname.replace(/\/$/, ""));

export default withNativeWind(config, {
  input: "./global.css",
  forceWriteFileSystem: true,
});
