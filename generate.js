#!/usr/bin/env node
// CLI: node generate.js <input.json> [output.xlsx] [--dry-run]
import fs from 'node:fs/promises';
import path from 'node:path';
import 'dotenv/config';

import { recommendThemes, recommendThemesDryRun } from './lib/recommend.js';
import { generateThemePosts, generateThemePostsDryRun } from './lib/generate-posts.js';
import { writeWorkbook } from './lib/excel-writer.js';

function parseArgs(argv) {
  const args = { dryRun: false, themesOnly: false, positional: [] };
  for (const a of argv.slice(2)) {
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--themes-only') args.themesOnly = true;
    else if (a === '--help' || a === '-h') args.help = true;
    else args.positional.push(a);
  }
  return args;
}

function printHelp() {
  console.log(`Threads 社群貼文產生器

用法:
  node generate.js <input.json> [output.xlsx] [options]

選項:
  --dry-run      不打 Claude API,用假資料測 schema/排程/Excel 輸出
  --themes-only  只跑 AI 主題推薦,不生成內容(只列出推薦的主題)
  --help / -h    顯示說明

範例:
  node generate.js examples/input-87grill.json
  node generate.js examples/input-87grill.json output/87grill.xlsx
  node generate.js examples/input-87grill.json --dry-run

input.json 結構:
{
  "brand": "87 霸氣烤魚火鍋",
  "product": "金湯酸菜烤魚火鍋",
  "product_features": "...(長文)...",
  "audience": "25-40 歲愛吃辣的上班族/小資族",
  "brand_persona": "霸氣、挑釁、台味黑色幽默",
  "purchase_url": "https://lin.ee/xxx",
  "product_images": ["https://i.ibb.co/...", ...],
  "platforms": ["Threads", "IG", "FB"],
  "monthly_total": 150,
  "start_date": "2026-06-08"
}
`);
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || args.positional.length === 0) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  const inputPath = args.positional[0];
  const outputPath = args.positional[1]
    || path.join('output', path.basename(inputPath, '.json') + '.xlsx');

  const input = JSON.parse(await fs.readFile(inputPath, 'utf-8'));

  console.log(`\n📌 Threads 貼文產生器 ${args.dryRun ? '(DRY RUN)' : ''}`);
  console.log(`   品牌: ${input.brand}`);
  console.log(`   產品: ${input.product}`);
  console.log(`   輸出: ${outputPath}\n`);

  // Step 1: AI 推薦主題
  console.log('🔮 Step 1: AI 推薦主題...');
  const themes = args.dryRun
    ? recommendThemesDryRun(input)
    : await recommendThemes(input);

  console.log(`   ✅ 推薦 ${themes.length} 個主題:`);
  themes.forEach((t) => {
    console.log(`      • ${t.name} (${t.type}) — ${t.monthly_count} 篇/月 @ ${t.schedule}`);
  });

  if (args.themesOnly) {
    console.log('\n✨ --themes-only 模式,僅輸出主題清單。');
    return;
  }

  // Step 2: 各主題批次生成
  console.log('\n📝 Step 2: 各主題批次生成內容...');
  const postsByTheme = new Map();
  for (let i = 0; i < themes.length; i++) {
    const theme = themes[i];
    console.log(`\n   [${i + 1}/${themes.length}] ${theme.name} (目標 ${theme.monthly_count || 30} 篇)`);
    const posts = args.dryRun
      ? generateThemePostsDryRun({ theme, input })
      : await generateThemePosts({
          theme, input,
          onProgress: ({ batch, batches, posts: cur, target }) => {
            process.stdout.write(`     ⏳ batch ${batch}/${batches} (${cur}/${target} 篇)\r`);
          },
        });
    console.log(`     ✅ 完成 ${posts.length} 篇`);
    postsByTheme.set(theme.name, posts);
  }

  // Step 3: 寫 Excel
  console.log('\n📤 Step 3: 輸出 Excel...');
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const startDate = input.start_date ? new Date(input.start_date) : new Date();
  await writeWorkbook({ input, themes, postsByTheme, outputPath, startDate });
  console.log(`   ✅ ${outputPath}`);

  const totalPosts = Array.from(postsByTheme.values()).reduce((s, a) => s + a.length, 0);
  console.log(`\n🎉 完成! 共產出 ${totalPosts} 篇貼文,涵蓋 ${themes.length} 個主題。`);
}

main().catch((err) => {
  console.error('\n❌ 錯誤:', err.message);
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
});
