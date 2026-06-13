// Excel 輸出:跟 87 烤魚 / Infuz / 瑞際的 schema 對齊
import ExcelJS from 'exceljs';
import { getPostType } from './schemas.js';
import { generateScheduleDates, formatDateTime } from './schedule.js';
import { normalizeInput } from './normalize.js';

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
const HEADER_FONT = { color: { argb: 'FFFFFFFF' }, bold: true, size: 11 };
const ALT_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F7FC' } };

function setHeader(row) {
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCFD8DC' } },
      left: { style: 'thin', color: { argb: 'FFCFD8DC' } },
      bottom: { style: 'thin', color: { argb: 'FFCFD8DC' } },
      right: { style: 'thin', color: { argb: 'FFCFD8DC' } },
    };
  });
  row.height = 32;
}

function setupSheet(ws, columns) {
  ws.columns = columns.map((c) => ({ header: c, key: c, width: columnWidth(c) }));
  setHeader(ws.getRow(1));
}

function columnWidth(name) {
  if (name === '文案內容') return 60;
  if (name === '首句 Hook 內容' || name === '首句Hook' || name === '標題' || name === '題目') return 32;
  if (name === '主題' || name === '主題分類' || name === '主題類型') return 18;
  if (name === '發文時間') return 20;
  if (name === '產品圖' || name === 'AI圖' || name === '網址') return 36;
  if (name === '編號' || name === '#') return 8;
  if (name === '字數設定' || name === '字數') return 10;
  return 16;
}

/**
 * Sheet 1: 發文規劃 (master)
 */
function writeMasterSheet(wb, themes, input) {
  const ws = wb.addWorksheet('發文規劃', {
    properties: { tabColor: { argb: 'FFFFA000' } },
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  setupSheet(ws, [
    '發文主題', '發文類型', '發文時間', '發文平台', '每月篇數', '是否上線', '備註',
  ]);

  themes.forEach((t, i) => {
    const row = ws.addRow({
      '發文主題': t.name,
      '發文類型': getPostType(t.type).label,
      '發文時間': t.schedule,
      '發文平台': (t.platforms || ['Threads']).join('/'),
      '每月篇數': t.monthly_count || 30,
      '是否上線': true,
      '備註': t.rationale || '',
    });
    if (i % 2 === 1) row.eachCell({ includeEmpty: true }, (c) => { c.fill = ALT_FILL; });
    row.alignment = { vertical: 'middle', wrapText: true };
  });

  // 加品牌資訊 in 右側
  ws.getCell('I1').value = '品牌設定';
  ws.getCell('I1').fill = HEADER_FILL;
  ws.getCell('I1').font = HEADER_FONT;
  const settings = [
    ['品牌', input.brand],
    ['產品', input.product],
    ['受眾', input.audience],
    ['品牌人格', input.brand_persona],
    ['購買連結', input.purchase_url || ''],
    ['啟用平台', (input.platforms || ['Threads']).join('/')],
    ['生成日期', formatDateTime(new Date())],
  ];
  settings.forEach((row, i) => {
    ws.getCell(`I${i + 2}`).value = row[0];
    ws.getCell(`I${i + 2}`).font = { bold: true };
    ws.getCell(`J${i + 2}`).value = row[1];
    ws.getCell(`J${i + 2}`).alignment = { wrapText: true };
  });
  ws.getColumn('I').width = 14;
  ws.getColumn('J').width = 50;
}

/**
 * 各主題 sheet:依 type 的 columns 寫
 */
function writeThemeSheet(wb, theme, posts, startDate, input) {
  const type = getPostType(theme.type);
  const ws = wb.addWorksheet(safeSheetName(theme.name), {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  setupSheet(ws, type.columns);

  // 沒提供 startDate (空字串 / null / 沒給) → 跳過排程計算,發文時間欄留空
  const hasStartDate = !!startDate && (startDate instanceof Date ? !isNaN(startDate.getTime()) : true);
  const dates = hasStartDate
    ? generateScheduleDates({
        scheduleStr: theme.schedule,
        count: posts.length,
        startDate,
      })
    : [];

  posts.forEach((post, i) => {
    // 找出本篇對應的 product (依 product_index,fallback 到 products[0])
    const pi = Number.isInteger(post.product_index) && post.product_index >= 0
      && post.product_index < input.products.length
        ? post.product_index : 0;
    const product = input.products[pi] || input.products[0];

    const rowData = {};
    for (const col of type.columns) {
      if (col === '編號' || col === '#') rowData[col] = i + 1;
      else if (col === '發文時間') rowData[col] = dates[i] ? formatDateTime(dates[i]) : '';
      else if (col === '產品圖') rowData[col] = pickRandom(product?.images) || '';
      else if (col === 'AI圖') rowData[col] = post.AI圖 || '';
      else if (col === '網址') rowData[col] = post.網址 || product?.purchase_url || input.purchase_url || '';
      else if (col === '產品名稱') rowData[col] = product?.name || '';
      // 注意 schemas.js 用「首句 Hook 內容」「核心痛點觸發」等,LLM 回的 key 沒空格
      else if (col === '首句 Hook 內容') rowData[col] = post['首句Hook'] || post['首句 Hook 內容'] || '';
      else if (col === '核心痛點觸發') rowData[col] = post['核心痛點'] || post['核心痛點觸發'] || '';
      else if (col === '產品亮點變數') rowData[col] = post['產品亮點'] || post['產品亮點變數'] || '';
      else if (col === '情緒/對話感語法') rowData[col] = post['情緒語法'] || post['情緒/對話感語法'] || '';
      else if (col === '互動觸發點 (CTA)') rowData[col] = post['CTA'] || post['互動觸發點 (CTA)'] || '';
      else if (col === '字數設定') rowData[col] = post['字數'] || post['字數設定'] || '';
      else if (col === 'Prompt 核心關鍵字') rowData[col] = post['Prompt核心關鍵字'] || post['Prompt 核心關鍵字'] || '';
      // 貼文內容 / 文案內容 是同義詞,LLM 偶爾混用
      else if (col === '貼文內容') rowData[col] = post['貼文內容'] || post['文案內容'] || '';
      else if (col === '文案內容') rowData[col] = post['文案內容'] || post['貼文內容'] || '';
      else rowData[col] = post[col] != null ? String(post[col]) : '';
    }
    const row = ws.addRow(rowData);
    if (i % 2 === 1) row.eachCell({ includeEmpty: true }, (c) => { c.fill = ALT_FILL; });
    row.alignment = { vertical: 'top', wrapText: true };
    // 文案行高拉高
    if (type.columns.includes('文案內容') && post.文案內容) {
      const lines = String(post.文案內容).split(/\r?\n/).length;
      row.height = Math.min(Math.max(20, lines * 14), 240);
    }
  });
}

/**
 * 產品資訊 sheet (對齊既有 87/瑞際 schema)
 */
function writeProductSheet(wb, input) {
  const ws = wb.addWorksheet('產品資訊', {
    properties: { tabColor: { argb: 'FF26A69A' } },
  });
  setupSheet(ws, ['#', '產品', '產品特色', '產品圖', '購買連結']);
  input.products.forEach((p, i) => {
    const row = ws.addRow({
      '#': i,
      '產品': p.name,
      '產品特色': p.features,
      '產品圖': (p.images || []).join('\n'),
      '購買連結': p.purchase_url || input.purchase_url || '',
    });
    row.alignment = { vertical: 'top', wrapText: true };
    const lines = Math.max(
      (p.features || '').split(/\n/).length,
      (p.images || []).length
    );
    row.height = Math.min(Math.max(40, lines * 14), 240);
    if (i % 2 === 1) row.eachCell({ includeEmpty: true }, (c) => { c.fill = ALT_FILL; });
  });
}

function pickRandom(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function safeSheetName(name) {
  // Excel sheet 名禁用字元: \ / ? * [ ] : 且 ≤ 31 字
  let n = String(name).replace(/[\\\/\?\*\[\]\:]/g, '_');
  if (n.length > 31) n = n.slice(0, 31);
  return n || 'Sheet';
}

/**
 * 全部彙整 sheet — 只列有 AI圖 的 post,3 欄 (編號/文案/AI圖片)
 * 給用戶在圖片管理階段刪過後快速拿到「能用」的清單
 */
function writeSummarySheet(wb, themes, postsByTheme) {
  const ws = wb.addWorksheet('全部彙整', {
    properties: { tabColor: { argb: 'FFD81B60' } },
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  setupSheet(ws, ['編號', '文案', 'AI圖片']);
  // 編號連跑、跨主題;只列有 AI圖 的 post
  let counter = 0;
  for (const theme of themes) {
    if (theme.type !== 'product_with_image') continue;
    const posts = postsByTheme.get(theme.name) || [];
    posts.forEach((post) => {
      const aiUrl = String(post.AI圖 || '').trim();
      if (!aiUrl) return;
      counter++;
      const text = post.文案內容 || post.貼文內容 || '';
      const row = ws.addRow({ '編號': counter, '文案': text, 'AI圖片': aiUrl });
      if (counter % 2 === 0) row.eachCell({ includeEmpty: true }, (c) => { c.fill = ALT_FILL; });
      row.alignment = { vertical: 'top', wrapText: true };
      const lines = String(text).split(/\r?\n/).length;
      row.height = Math.min(Math.max(20, lines * 14), 240);
    });
  }
  ws.getColumn('編號').width = 8;
  ws.getColumn('文案').width = 70;
  ws.getColumn('AI圖片').width = 60;
}

/**
 * 內部:建好 workbook 並回傳 instance
 */
function buildWorkbook({ input: rawInput, themes, postsByTheme, startDate }) {
  const input = normalizeInput(rawInput);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Threads Generator';
  wb.created = new Date();

  writeMasterSheet(wb, themes, input);

  // 彙整 sheet 放在 master 後、各主題 sheet 前
  writeSummarySheet(wb, themes, postsByTheme);

  for (const theme of themes) {
    const posts = postsByTheme.get(theme.name) || [];
    writeThemeSheet(wb, theme, posts, startDate, input);
  }

  writeProductSheet(wb, input);
  return wb;
}

/**
 * 寫到本機檔案 (CLI 用)
 */
export async function writeWorkbook({ input, themes, postsByTheme, outputPath, startDate }) {
  const wb = buildWorkbook({ input, themes, postsByTheme, startDate });
  await wb.xlsx.writeFile(outputPath);
}

/**
 * 寫到 Buffer (serverless / Vercel 用,不依賴本機檔案系統)
 */
export async function writeWorkbookBuffer({ input, themes, postsByTheme, startDate }) {
  const wb = buildWorkbook({ input, themes, postsByTheme, startDate });
  return Buffer.from(await wb.xlsx.writeBuffer());
}
