import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://shuge.example.com",
  output: "static",
  server: {
    host: "0.0.0.0",
    port: 4321,
  },
  i18n: {
    defaultLocale: "zh",
    locales: ["zh", "zh-TW", "en", "ja"],
    routing: {
      prefixDefaultLocale: true,
      redirectToDefaultLocale: true,
    },
  },
  build: {
    // chapters are independent static pages; parallelize
    concurrency: 24,
  },
  integrations: [
    sitemap({
      i18n: {
        defaultLocale: "zh",
        locales: {
          zh: "zh-CN",
          "zh-TW": "zh-Hant",
          en: "en",
          ja: "ja",
        },
      },
    }),
  ],
});
