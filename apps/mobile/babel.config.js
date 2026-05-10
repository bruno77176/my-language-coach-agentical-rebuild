module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: [
      // MUST be last. Required by react-native-reanimated 4 / @gorhom/bottom-sheet.
      "react-native-worklets/plugin",
    ],
  };
};
