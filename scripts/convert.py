#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Convert the chinese-novel HTML dataset into clean Markdown files.

Input : source-data/resources/<bookType>/<bookName>/{info.json, N.html}
Output: output/<bookType>/<bookName>/{info.json, chapters.json, NNN.md}
        output/books.json (aggregate index)
"""
import html
import json
import os
import re
import sys
import time
from collections import Counter

SRC = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "source-data", "resources")
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "output")

# --- phase-2 cleaning -------------------------------------------------------
CJK = r"\u4e00-\u9fff"
CJK_PUNCT = r"\u3000-\u303f\uff00-\uffef\u2014\u2026\u2018\u2019\u201c\u201d"
SPACE_CHARS = r" \t\u3000\xa0\u2000-\u200b\u202f\u205f"

WATERMARK_PARAS = (
    re.compile(r"txshuku|txshuk", re.I),
    re.compile(r"doubleads", re.I),
    re.compile(r"16\s*[kKｋＫ]|1６|１６", re.I),
    re.compile(r"小[\W_]*说[\W_]*天[\W_]*堂|小说天堂", re.I),
    re.compile(r"(?:www|tvt|txt)\S*\s*\.\s*[a-z］）]", re.I),
)

WATERMARK_INLINE = re.compile(
    r"\[?(?:email\s*)?(?:protected|protec)t?\]?|/cdn-cgi/l/email-protection|"
    r"__cf_email__|data-cfemail|data-cfhash|(?:web用戶請登陸|手機用戶登陸|下載TXT格式小說)[^。；]*?．?[A-Za-z0-9,.]*"
    r"|wWw\.16Ｋ\.ｃn首發|16k小说wWw\.16Ｋ\.ｃn首發",
    re.I,
)

# token (matched case-insensitively, standalone within CJK context) -> replacement
PINYIN_FIX = [
    (r"yang物", "阳物"),
    (r"pin户", "阴户"),
    (r"jiba", "鸡巴"),
    (r"gui头", "龟头"),
    (r"li头", "露头"),
    (r"玉jing", "玉茎"),
    (r"ru头", "乳头"),
    (r"yin精", "阴精"),
    (r"si处", "私处"),
    (r"bi嘴", "逼嘴"),
    (r"bi皮", "逼皮"),
    (r"bi卵", "逼卵"),
    (r"bi里", "逼里"),
    (r"bi老", "逼老"),
    (r"bi运", "逼运"),
    (r"bi带膫", "逼带膫"),
    (r"bi儿", "逼儿"),
    (r"bi声", "逼声"),
    (r"chou动", "抽动"),
    (r"阴dao", "阴道"),
    (r"xiao穴", "小穴"),
    (r"阴mao", "阴毛"),
    (r"阴hu", "阴户"),
    (r"黑XuXu", "黑黢黢"),
    (r"荡DD", "荡漾"),
    (r"燸TM爚", ""),
    (r"阴jin", "阴精"),
    (r"请hiv阳性者", "请 HIV 阳性者"),
]
PINYIN_PAIRS = [(re.compile(p, re.I), r) for p, r in PINYIN_FIX]

PUA_BREAK = {"\ue004", "\ue003"}

PLACEHOLDER_RE = re.compile(r"内文缺|本章暂缺|缺失|文原缺|内容缺失|章节缺失")
NAV_TEXT = {
    "上一章", "下一章", "上一章:", "下一章:", "返回目录", "章节目录", "章节列表",
    "目录", "首页", "上一页", "下一页", "上一回", "下一回", "上一章：", "下一章：",
    "开始阅读", "继续阅读", "手机阅读", "电脑阅读", "加入书签", "推荐本书", "投推荐票",
    "最新", "排行榜", "全部章节", "阅读全书", "全书完", "完本", "收藏本书",
}
URL_RE = re.compile(r"https?://\S+", re.I)


def strip_spaces(s):
    return s.replace(" ", "")


def norm(s):
    return re.sub(r"[\s\u3000\xa0]+", "", s)


def clean_html(raw):
    t = raw
    t = re.sub(r"<!--.*?-->", "", t, flags=re.S)
    t = re.sub(r"<script\b.*?</script>", "", t, flags=re.S | re.I)
    t = re.sub(r"<script\b.*$", "", t, flags=re.S | re.I)
    t = re.sub(r"<style\b.*?</style>", "", t, flags=re.S | re.I)
    t = re.sub(r"<button\b.*?</button>", "", t, flags=re.S | re.I)
    t = re.sub(r"<button\b.*$", "", t, flags=re.S | re.I)
    t = html.unescape(t)
    t = t.replace("\xa0", " ")
    t = re.sub(r"</?br\s*/?>", "\n", t, flags=re.I)
    t = re.sub(r"</?p\s*/?>", "\n", t, flags=re.I)
    t = re.sub(
        r"</?(?:div|blockquote|h[1-6]|li|tr|table|font|span|u|center|a|em|strong)\b[^>]*>",
        "\n", t, flags=re.I,
    )
    t = re.sub(r"<[^>]+>", "", t)
    t = html.unescape(t)
    return t


def to_paragraphs(t):
    paras = []
    for ln in t.split("\n"):
        ln = ln.strip(" \t\u3000\xa0\r\n\ufeff")
        if not ln:
            continue
        if ln in NAV_TEXT:
            continue
        if URL_RE.search(ln):
            continue
        paras.append(ln)
    return paras


def _apply_pinyin(s, counter):
    replaced = False
    for pat, repl in PINYIN_PAIRS:
        if pat.search(s):
            s = pat.sub(repl, s)
            replaced = True
    if replaced:
        counter["book"] += 1
    return s


def _strip_spaces(s):
    """Remove spaces adjacent to CJK/CJK punctuation; keep spaces between latin."""
    out = list(s)
    i = 0
    while i < len(out):
        if re.match(f"[{SPACE_CHARS}]", out[i]):
            left = out[i - 1] if i > 0 else ""
            right = out[i + 1] if i + 1 < len(out) else ""
            if left and re.match(f"[{CJK}{CJK_PUNCT}]", left):
                del out[i]
                continue
            if right and re.match(f"[{CJK}{CJK_PUNCT}]", right):
                del out[i]
                continue
        i += 1
    return "".join(out)


def _split_pua(s, counter):
    idx = 0
    parts = []
    for i, ch in enumerate(s):
        if ch in PUA_BREAK:
            if s[idx:i]:
                parts.append(s[idx:i])
            counter["book"] += 1
            idx = i + 1
    if s[idx:]:
        parts.append(s[idx:])
    if len(parts) == 1:
        return [s]
    out = []
    for seg in parts:
        seg = seg.strip(" \t\u3000\xa0")
        if seg:
            out.append(seg)
    return out


def clean_text(paras, stats):
    """Apply watermark / space / pinyin / PUA cleaning to a list of paragraphs."""
    cleaned = []
    for para in paras:
        # PUA break chars split the paragraph
        for seg in _split_pua(para, stats["pua"]["break"]):
            # unknown PUA chars: keep text, log for report (user keeps them)
            unknown = re.findall(r"[\ue000-\uf8ff]", seg)
            if unknown:
                for u in unknown:
                    key = hex(ord(u))
                    rec = stats["pua"]["unknown"].setdefault(key, {"count": 0, "samples": []})
                    rec["count"] += 1
                    if len(rec["samples"]) < 3:
                        rec["samples"].append(seg[:80])
            # watermark paragraph removal
            low = seg.lower()
            if any(p.search(seg) for p in WATERMARK_PARAS) or (
                "txshuku" in low or "txt" in low or ("ww" in low and "." in seg)
            ):
                stats["watermark"][stats["book"]] += 1
                continue
            # inline cloudflare / email residue inside a real sentence
            if WATERMARK_INLINE.search(seg):
                stats["cfemail"][stats["book"]] += 1
                continue
            seg = _apply_pinyin(seg, stats["pinyin"])
            seg = _strip_spaces(seg)
            seg = seg.strip(" \t\u3000\xa0,.，。；;：:—~")
            if seg:
                cleaned.append(seg)
    return cleaned


def is_placeholder(paras):
    text = "".join(paras)
    text = PLACEHOLDER_RE.sub("", text)
    text = re.sub(r"[【】\[\]（）()《》〈〉：:。．·、，,；;\s\u3000\xa0]", "", text)
    return not text


def convert_book(book_type, book_name, src_dir, out_dir, report):
    with open(os.path.join(src_dir, "info.json"), encoding="utf-8") as f:
        meta = json.load(f)

    meta["name"] = strip_spaces(meta.get("name", book_name))
    out_name = strip_spaces(book_name)
    odir = os.path.join(out_dir, book_type, out_name)
    os.makedirs(odir, exist_ok=True)

    with open(os.path.join(odir, "info.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    catalogues = meta.get("catalogues", [])
    html_files = sorted(
        (int(n[:-5]) for n in os.listdir(src_dir) if n.endswith(".html") and n[:-5].isdigit())
    )
    expected = len(catalogues)

    if not html_files:
        report["emptyBooks"].append(f"{book_type}/{out_name}")
        chapters = []
    else:
        if len(html_files) != expected:
            report["countMismatch"].append(
                {"book": f"{book_type}/{out_name}", "htmlFiles": len(html_files), "catalogues": expected}
            )
        if html_files != list(range(min(html_files), max(html_files) + 1)):
            report["indexGaps"].append(f"{book_type}/{out_name}")

        chapters = []
        for idx in html_files:
            src = os.path.join(src_dir, f"{idx}.html")
            with open(src, encoding="utf-8") as f:
                raw = f.read()
            title = catalogues[idx].strip() if idx < len(catalogues) else None

            if title is None:
                report["extraFiles"].append({"book": f"{book_type}/{out_name}", "file": f"{idx}.html"})
                continue

            paras = to_paragraphs(clean_html(raw))

            if paras and norm(paras[0]) == norm(title):
                paras = paras[1:]

            stats = {
                "book": f"{book_type}/{out_name}",
                "watermark": report["watermark"],
                "cfemail": report["cfemail"],
                "pinyin": report["pinyin"],
                "pua": report["pua"],
            }
            paras = clean_text(paras, stats)

            missing = is_placeholder(paras)
            if missing:
                report["placeholderChapters"].append(
                    {"book": f"{book_type}/{out_name}", "file": f"{idx}.html", "title": title}
                )
                body = "*（本章内容缺失）*"
            else:
                body = "\n\n".join(paras)

            md_name = f"{idx:03d}.md"
            with open(os.path.join(odir, md_name), "w", encoding="utf-8") as f:
                f.write(f"# {title}\n\n{body}\n")

            chapters.append({"index": idx, "title": title, "file": md_name})

    with open(os.path.join(odir, "chapters.json"), "w", encoding="utf-8") as f:
        json.dump(
            {"name": meta["name"], "bookType": book_type, "chapterCount": len(chapters), "chapters": chapters},
            f, ensure_ascii=False, indent=2,
        )

    return {
        "id": f"{book_type}/{out_name}",
        "slug": out_name,
        "name": meta["name"],
        "bookType": book_type,
        "author": meta.get("author"),
        "words": meta.get("words"),
        "chapterCount": len(chapters),
        "intro": meta.get("intro"),
        "infoFile": f"{book_type}/{out_name}/info.json",
        "chaptersFile": f"{book_type}/{out_name}/chapters.json",
    }


def main():
    if not os.path.isdir(SRC):
        print(f"source dir not found: {SRC}", file=sys.stderr)
        sys.exit(1)

    report = {
        "emptyBooks": [],
        "countMismatch": [],
        "indexGaps": [],
        "extraFiles": [],
        "placeholderChapters": [],
        "emptyChapters": [],
        "watermark": Counter(),
        "cfemail": Counter(),
        "pinyin": Counter(),
        "pua": {
            "break": Counter(),
            "unknown": {},
        },
    }
    book_types = Counter()
    books = []
    total_chapters = 0
    start = time.time()

    for book_type in sorted(os.listdir(SRC)):
        btd = os.path.join(SRC, book_type)
        if not os.path.isdir(btd):
            continue
        for book_name in sorted(os.listdir(btd)):
            src_dir = os.path.join(btd, book_name)
            if not os.path.isdir(src_dir):
                continue
            info = convert_book(book_type, book_name, src_dir, OUT, report)
            books.append(info)
            book_types[book_type] += 1
            total_chapters += info["chapterCount"]

    books.sort(key=lambda b: (b["bookType"], b["name"]))
    with open(os.path.join(OUT, "books.json"), "w", encoding="utf-8") as f:
        json.dump(
            {
                "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
                "totalBooks": len(books),
                "totalChapters": total_chapters,
                "bookTypes": dict(book_types),
                "books": books,
            },
            f, ensure_ascii=False, indent=2,
        )
    with open(os.path.join(OUT, "_report.json"), "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(f"books: {len(books)}  chapters: {total_chapters}")
    print(f"bookTypes: {dict(book_types)}")
    for k in report:
        if report[k]:
            print(f"[{k}] {len(report[k])}")
    print(f"elapsed: {time.time() - start:.1f}s")


if __name__ == "__main__":
    main()
