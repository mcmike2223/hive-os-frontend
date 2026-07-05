import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";
import { defineConfig, globalIgnores } from "eslint/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export default defineConfig([
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "scripts/**",
    "*.js",
    "*.mjs",
  ]),
  {
    rules: {
      "@typescript-eslint/no-unused-expressions": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@next/next/no-img-element": "off",
      "@next/next/no-assign-module-variable": "off",
      "@typescript-eslint/no-require-imports": "off",
      "no-param-reassign": "off",
      "react-hooks/exhaustive-deps": "off",
      "react/no-unescaped-entities": "off",
      "prefer-const": "off",
      "@typescript-eslint/no-this-alias": "off",
      "react/jsx-no-comment-textnodes": "off",
    },
  },
]);
