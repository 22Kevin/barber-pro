module.exports = function (api) {
  api.cache(true);
  let plugins = [];

  plugins.push("react-native-worklets/plugin");

  return {
    presets: [
      ["babel-preset-expo", {
        jsxImportSource: "nativewind",
        reactCompiler: false,
      }],
      "nativewind/babel",
    ],
    plugins,
  };
};
