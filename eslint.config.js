import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import {
  defineConfig,
  globalIgnores,
} from "eslint/config";

export default defineConfig([
  globalIgnores([
    "dist/**",

    ".role-mobile-notification-backups/**",

    ".workspace-settings-flicker-backups/**",
  ]),

  {
    files: [
      "**/*.{js,jsx}",
    ],

    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],

    languageOptions: {
      globals:
        globals.browser,

      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },

    rules: {
      /*
       * These remain visible as warnings but do not block security
       * releases while their existing call sites are reviewed.
       */

      "no-unused-vars":
        "warn",

      "no-useless-assignment":
        "warn",

      "react-hooks/set-state-in-effect":
        "warn",

      "react-hooks/preserve-manual-memoization":
        "warn",
    },
  },
]);
