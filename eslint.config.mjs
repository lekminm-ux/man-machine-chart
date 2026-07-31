import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Local-only forensic backup from the OneDrive migration — not app source.
    "_Backup_scratch_OneDriveMigration_20260719/**",
    // Node test-runner specs use CommonJS require() on purpose.
    "tests/**/*.cjs",
  ]),
]);

export default eslintConfig;
