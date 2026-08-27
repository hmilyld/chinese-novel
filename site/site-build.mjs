#!/usr/bin/env node
/**
 * site-build.mjs — build site-consumable data from site-content/zh.
 *
 * Inputs:
 *   site-content/zh/<bookType>/<bookName>/{info.json, chapters.json, NNN.md}
 * Outputs:
 *   site-content/books.json              aggregated book metadata (all locales)
 *   site-content/zh-TW/<id>/chapters.json  OpenCC-converted chapter index (--full)
 *   site-content/zh-TW/<id>/<file>.md      OpenCC-converted bodies (--full, cached)
 *
 * en/ja content dirs (site-content/en|ja) are reserved for future translations;
 * their presence flips the `translated` flags in books.json.
 *
 * Usage: node site-build.mjs [--full]
 *   --full   also pre-render zh-TW bodies + chapter indexes (required before `astro build`)
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { Converter } from "opencc-js";

const ROOT = new URL("../", import.meta.url).pathname;
const SITE_CONTENT = process.env.SHUGE_CONTENT ?? join(ROOT, "site-content");
const ZH = join(SITE_CONTENT, "zh");
const FULL = process.argv.includes("--full");

const s2tw = Converter({ from: "cn", to: "tw" });
const stripSpaces = (s) => s.replace(/\s+/g, "");

// ── scan zh books ─────────────────────────────────────────
if (!existsSync(ZH)) {
  console.error(`zh content dir not found: ${ZH}`);
  process.exit(1);
}

const books = [];
const bookTypes = {};
let totalChapters = 0;

for (const bookType of readdirSync(ZH).sort()) {
  const typeDir = join(ZH, bookType);
  for (const bookName of readdirSync(typeDir).sort()) {
    const bookDir = join(typeDir, bookName);
    const info = JSON.parse(readFileSync(join(bookDir, "info.json"), "utf-8"));
    const chaptersFile = join(bookDir, "chapters.json");
    const chapters = existsSync(chaptersFile)
      ? JSON.parse(readFileSync(chaptersFile, "utf-8")).chapters
      : [];
    const name = stripSpaces(info.name ?? bookName);
    const id = `${bookType}/${name}`;
    // joint attributions like "冯梦龙 蔡元放" are separate people — split into
    // an array; `author` stays the joined display string
    const authorNames = [
      ...new Set(
        (info.author?.name ?? "佚名")
          .split(/[\s、，,]+/)
          .map((s) => s.trim())
          .filter(Boolean)
      ),
    ];

    books.push({
      id,
      slug: name,
      name,
      bookType,
      dynasty: info.author?.dynasty ?? "未知",
      author: authorNames.join("、"),
      authors: authorNames,
      authorIntro:
        info.author?.intro && info.author.intro !== "暂无信息"
          ? info.author.intro
          : "",
      words: info.words ?? 0,
      chapterCount: chapters.length,
      intro: info.intro ?? "",
      translated: {
        zh: true,
        "zh-TW": true,
      },
    });
    bookTypes[bookType] = (bookTypes[bookType] ?? 0) + 1;
    totalChapters += chapters.length;
  }
}

books.sort((a, b) => a.bookType.localeCompare(b.bookType, "zh") || a.name.localeCompare(b.name, "zh"));

const meta = {
  generatedAt: new Date().toISOString(),
  totalBooks: books.length,
  totalChapters,
  bookTypes,
  books,
};

writeFileSync(
  join(SITE_CONTENT, "books.json"),
  JSON.stringify(meta, null, 1),
  "utf-8"
);
console.log(`books: ${books.length}  chapters: ${totalChapters}`);
console.log(`bookTypes:`, bookTypes);
console.log("wrote site-content/books.json");

// ── zh-TW (--full) ────────────────────────────────────────
if (!FULL) {
  console.log("skipping zh-TW conversion (use --full)");
  console.log("done.");
  process.exit(0);
}

let bodies = 0;
let indexes = 0;
let infos = 0;
for (const b of books) {
  const zhDir = join(ZH, b.id);
  const twDir = join(SITE_CONTENT, "zh-TW", b.id);
  const zhChaptersFile = join(zhDir, "chapters.json");
  if (!existsSync(zhChaptersFile)) continue;
  const src = JSON.parse(readFileSync(zhChaptersFile, "utf-8"));
  mkdirSync(twDir, { recursive: true });

  // chapter index: convert name + titles
  const tw = {
    name: s2tw(src.name ?? b.name),
    bookType: src.bookType ?? b.bookType,
    chapterCount: src.chapterCount ?? b.chapterCount,
    chapters: src.chapters.map((c) => ({ ...c, title: s2tw(c.title) })),
  };
  writeFileSync(join(twDir, "chapters.json"), JSON.stringify(tw, null, 1), "utf-8");
  indexes++;

  // info.json mirror: convert display text, keep identifiers/numbers as-is
  const zhInfoFile = join(zhDir, "info.json");
  if (existsSync(zhInfoFile)) {
    const info = JSON.parse(readFileSync(zhInfoFile, "utf-8"));
    const twInfo = {
      name: s2tw(info.name ?? b.name),
      catalogues: (info.catalogues ?? []).map((t) => s2tw(t)),
      catalogueTotal: info.catalogueTotal ?? 0,
      bookType: info.bookType ?? b.bookType,
      words: info.words ?? 0,
      author: {
        dynasty: info.author?.dynasty ?? "未知",
        intro: info.author?.intro ? s2tw(info.author.intro) : "",
        name: info.author?.name ? s2tw(info.author.name) : "佚名",
      },
      intro: info.intro ? s2tw(info.intro) : "",
    };
    writeFileSync(
      join(twDir, "info.json"),
      JSON.stringify(twInfo, null, 2),
      "utf-8"
    );
    infos++;
  }

  // bodies (cached)
  for (const c of src.chapters) {
    const srcFile = join(zhDir, c.file);
    if (!existsSync(srcFile)) continue;
    const destFile = join(twDir, c.file);
    if (existsSync(destFile)) {
      bodies++;
      continue;
    }
    mkdirSync(dirname(destFile), { recursive: true });
    writeFileSync(destFile, s2tw(readFileSync(srcFile, "utf-8")), "utf-8");
    bodies++;
  }
}
console.log(`zh-TW bodies converted: ${bodies}`);
console.log(`zh-TW chapter indexes written: ${indexes}`);
console.log(`zh-TW info files written: ${infos}`);
console.log("done.");
