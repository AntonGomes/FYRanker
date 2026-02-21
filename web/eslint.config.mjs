import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import aiGuardrails, { typescript as aiGuardrailsTs } from "eslint-config-ai-guardrails";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...aiGuardrails,
  ...aiGuardrailsTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
