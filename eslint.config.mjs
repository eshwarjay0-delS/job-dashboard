import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "node_modules/**",
  ]),
  {
    rules: {
      // Allow <img> — we use Clearbit logo API with unknown domains
      "@next/next/no-img-element": "off",
      // Allow explicit any in a few low-level helpers
      "@typescript-eslint/no-explicit-any": "warn",
      // Allow empty catch blocks (fetch fallbacks)
      "@typescript-eslint/no-empty-object-type": "off",

      // ── React Compiler advisories → warn (not error) ──────────────────────
      // These rules ship with React 19 / Next 16's hooks plugin and flag
      // patterns that the React Compiler would prefer to optimize. They are
      // optimization hints, NOT correctness bugs (e.g. reading localStorage in
      // an effect then calling setState). This app hasn't adopted the compiler
      // yet, so surface them as warnings rather than blocking the build.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",

      // Unescaped apostrophes/quotes in JSX copy render fine — stylistic only.
      "react/no-unescaped-entities": "warn",
    },
  },
]);

export default eslintConfig;
