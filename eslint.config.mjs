import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
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
      // The existing application intentionally performs synchronous hydration
      // and animation setup in effects. Keep the pre-upgrade lint baseline
      // until those flows can be migrated without changing runtime behavior.
      "react-hooks/immutability": "off",
      "react-hooks/incompatible-library": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/purity": "off",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/static-components": "off",
      // Auth and tenant boundary changes intentionally use hard navigation to
      // clear in-memory state; router navigation would change that behavior.
      "@next/next/no-location-assign-relative-destination": "off",
      "react/no-unescaped-entities": "off",
      "prefer-const": "off",
      "@typescript-eslint/no-this-alias": "off",
      "react/jsx-no-comment-textnodes": "off",
    },
  },
]);
