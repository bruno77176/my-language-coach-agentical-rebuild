import config from "@language-coach/config/eslint";

export default [
  ...config,
  {
    ignores: [".next/**", "next-env.d.ts"],
  },
];
