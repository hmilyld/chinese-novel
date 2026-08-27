import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    ignores: [
      "dist",
      "site-content/zh-TW",
      "site-content/books.json",
      "scripts/.meta-parts",
      "scripts/glossaries",
      "scripts/translate-usage.jsonl",
      "node_modules",
    ],
  },
  {
    files: ["site/src/**/*.{ts,astro}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        // Astro
        Astro: "readonly",
        // Node
        console: "readonly",
        process: "readonly",
        URL: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": "off",
    },
  },
  {
    files: ["site/site-build.mjs", "scripts/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        console: "readonly",
        process: "readonly",
        URL: "readonly",
        fetch: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": "off",
    },
  },
];
