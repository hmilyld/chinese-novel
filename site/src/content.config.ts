import { defineCollection, z } from "astro:content";
import type { Loader, LoaderContext } from "astro/loaders";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SITE_CONTENT =
  process.env.SHUGE_CONTENT ?? join(process.cwd(), "..", "site-content");

function booksLoader(): Loader {
  return {
    name: "shuge-books",
    load: async (ctx: LoaderContext) => {
      const all = JSON.parse(
        readFileSync(join(SITE_CONTENT, "books.json"), "utf-8")
      ) as { books: Record<string, unknown>[] };
      for (const b of all.books) {
        ctx.store.set({ id: b.id as string, data: b });
      }
    },
  };
}

export const collections = {
  books: defineCollection({
    loader: booksLoader(),
    schema: z.object({
      id: z.string(),
      slug: z.string(),
      name: z.string(),
      bookType: z.string(),
      dynasty: z.string(),
      author: z.string(),
      authors: z.array(z.string()),
      authorIntro: z.string(),
      words: z.number(),
      chapterCount: z.number(),
      intro: z.string(),
      translated: z.record(z.string(), z.boolean()),
      infoFile: z.string(),
      chaptersFile: z.string(),
    }),
  }),
};