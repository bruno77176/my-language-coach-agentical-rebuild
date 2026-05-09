import config from "@language-coach/config/eslint";

export default [
  ...config,
  {
    ignores: ["babel.config.js", "metro.config.js", "tailwind.config.js"],
  },
];
