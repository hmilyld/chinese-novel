import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export type Locale = "zh" | "zh-TW";

export const ROOT = new URL("../../..", import.meta.url).pathname;
export const SITE_CONTENT = process.env.SHUGE_CONTENT ?? join(ROOT, "site-content");

/** Resolve the body for a given language. Returns null if a translation is missing. */
export function readChapterBody(
  lang: Locale,
  bookId: string,
  file: string
): string | null {
  const f = join(SITE_CONTENT, lang, bookId, file);
  if (!existsSync(f)) return null;
  return readFileSync(f, "utf-8");
}

/** Chapter index lookup order: traditional falls back to simplified. */
function chapterIndexOrder(lang: Locale): Locale[] {
  return lang === "zh-TW" ? ["zh-TW", "zh"] : ["zh"];
}

/** Read the chapters index for a book (title/file pairs), locale-aware.
 *  Traditional Chinese readers get converted titles when a per-language index
 *  exists; otherwise it falls back to zh. */
export function readChapters(bookId: string, locale: Locale = "zh") {
  for (const l of chapterIndexOrder(locale)) {
    const file = join(SITE_CONTENT, l, bookId, "chapters.json");
    if (!existsSync(file)) continue;
    return JSON.parse(readFileSync(file, "utf-8")).chapters as {
      index: number;
      title: string;
      file: string;
    }[];
  }
  return null;
}


/** Parse an md chapter into { raw, title, body }. */
export function parseChapter(md: string) {
  const lines = md.split("\n");
  let title = "";
  const body: string[] = [];
  let inBody = false;
  for (const line of lines) {
    if (!inBody && line.startsWith("#")) {
      title = line.replace(/^#+\s*/, "").trim();
      inBody = true;
      continue;
    }
    body.push(line);
  }
  return { raw: md, title, body, fullText: body.join("\n") };
}

/** Book types with display labels (simplified Chinese). */
export const BOOK_TYPES: { key: string; label: string }[] = [
  { key: "世态人情", label: "世态人情" },
  { key: "鬼怪神魔", label: "鬼怪神魔" },
  { key: "历史演义", label: "历史演义" },
  { key: "英雄传奇", label: "英雄传奇" },
  { key: "谴责公案", label: "谴责公案" },
  { key: "传奇小说", label: "传奇小说" },
  { key: "其他", label: "其他" },
];

export const BOOK_TYPE_LABEL = (key: string) => {
  return BOOK_TYPES.find((x) => x.key === key)?.label ?? key;
};

export interface BookSummary {
  id: string;
  slug: string;
  name: string;
  bookType: string;
  dynasty: string;
  words: number;
  chapterCount: number;
}

export interface AuthorEntry {
  slug: string;
  name: string;
  dynasty: string;
  bio: string;
  bookCount: number;
  books: BookSummary[];
}

/** Group books by author. A book with joint attribution (authors: ["A","B"])
 *  appears under every named author. Picks the longest available bio. */
export function buildAuthors(
  books: { data: Record<string, any> }[]
): AuthorEntry[] {
  const map = new Map<string, AuthorEntry>();
  for (const b of books) {
    const d = b.data;
    const names: string[] = Array.isArray(d.authors) && d.authors.length
      ? d.authors
      : [String(d.author ?? "").trim() || "佚名"];
    for (const name of names) {
      let a = map.get(name);
      if (!a) {
        a = {
          slug: name,
          name,
          dynasty: String(d.dynasty ?? ""),
          bio: String(d.authorIntro ?? ""),
          bookCount: 0,
          books: [],
        };
        map.set(name, a);
      }
      a.bookCount += 1;
      a.books.push({
        id: d.id,
        slug: d.slug,
        name: d.name,
        bookType: d.bookType,
        dynasty: d.dynasty,
        words: d.words,
        chapterCount: d.chapterCount,
      });
      if (String(d.authorIntro ?? "").length > a.bio.length) {
        a.bio = String(d.authorIntro ?? "");
      }
      if (!a.dynasty || a.dynasty === "未知") {
        a.dynasty = d.dynasty;
      }
    }
  }
  const list = [...map.values()].sort(
    (x, y) => y.bookCount - x.bookCount || x.name.localeCompare(y.name, "zh")
  );
  for (const a of list) {
    a.books.sort((x, y) => y.words - x.words);
  }
  return list;
}