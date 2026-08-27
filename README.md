# 中国古典小说网

收录 441 部古典小说，共计 20,616 回，涵盖世态人情、鬼怪神魔、历史演义、英雄传奇、谴责公案、传奇小说等七大类。

## 功能

- 简繁双语切换（繁体通过 OpenCC 自动转换）
- 横排 / 竖排阅读模式
- 明暗主题切换
- 字体大小调节
- 按书名、作者、朝代检索
- 全文搜索
- 移动端适配

## 技术栈

- [Astro](https://astro.build/) — 静态站点生成
- [OpenCC](https://github.com/nickvdyck/opencc-js) — 简繁转换
- [pnpm](https://pnpm.io/) — 包管理

## 目录结构

```
site-content/
  zh/                      # 简体中文（数据源）
    <bookType>/
      <bookName>/
        info.json           # 书籍元信息
        chapters.json       # 章节目录
        000.md, 001.md ...  # 章节正文
  zh-TW/                   # 繁体中文（由 site-build 生成）
  books.json               # 聚合元数据（由 site-build 生成）
site/                      # Astro 站点
scripts/                   # 工具脚本
```

## 开发

```bash
# 重建站点数据（含繁体镜像）
node site/site-build.mjs --full

# 启动开发服务器（localhost:4321）
cd site
pnpm dev

# 构建静态站点
pnpm build
```

## 环境变量

| 变量            | 说明                  | 默认值            |
| --------------- | --------------------- | ----------------- |
| `SHUGE_CONTENT` | site-content 目录路径 | `../site-content` |

## 数据来源

本站数据源自网络收集的古典小说电子文本，经过系统化整理和格式转换。所有内容仅供学习和研究使用，版权归原作者所有。

## License

MIT
