// 補圖工坊 — 上傳 xlsx + 解析任務
// 找出 product_with_image 主題 sheet 裡有「Prompt核心關鍵字」+「產品圖」但「AI圖」是空的 row
// 上傳原 xlsx 到 Cloudinary,讓 /finalize 之後從那個 URL 取回
import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { uploadRawToCloudinary } from '@/lib/cloudinary.js';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    if (!file || !file.arrayBuffer) {
      return NextResponse.json({ error: '請上傳 xlsx 檔案' }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());

    // 上傳原 xlsx 到 Cloudinary
    const up = await uploadRawToCloudinary(buffer, {
      folder: 'threads-generator/bu-tu-source',
      filename: file.name || 'source.xlsx',
    });

    // 用 exceljs 解析
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);

    // 從「發文規劃」抓品牌
    let brand = '';
    const masterSheet = wb.getWorksheet('發文規劃');
    if (masterSheet) {
      // 品牌欄位通常在 J 欄第 2 列(對應 I=品牌 / J=值)
      for (let r = 2; r <= 10; r++) {
        const labelCell = masterSheet.getCell(`I${r}`).value;
        if (String(labelCell || '').includes('品牌')) {
          brand = String(masterSheet.getCell(`J${r}`).value || '');
          break;
        }
      }
    }

    // 從「產品資訊」抓 SKU 對應圖片
    const productMap = new Map();
    const productSheet = wb.getWorksheet('產品資訊');
    if (productSheet) {
      const headerRow = productSheet.getRow(1);
      const headers = headerRow.values.slice(1).map((v) => String(v || ''));
      const nameIdx = headers.indexOf('產品');
      const imgIdx = headers.indexOf('產品圖');
      const urlIdx = headers.indexOf('購買連結');
      productSheet.eachRow((row, rowNum) => {
        if (rowNum === 1) return;
        const vals = row.values.slice(1);
        const name = String(vals[nameIdx] || '').trim();
        if (!name) return;
        productMap.set(name, {
          images: String(vals[imgIdx] || '').split(/\n/).map((s) => s.trim()).filter(Boolean),
          url: String(vals[urlIdx] || ''),
        });
      });
    }

    // 掃描所有主題 sheet,找有 AI圖 欄位的
    const tasks = [];
    const sheetsScanned = [];
    for (const ws of wb.worksheets) {
      if (ws.name === '發文規劃' || ws.name === '產品資訊') continue;
      const headers = (ws.getRow(1).values || []).slice(1).map((v) => String(v || ''));
      const aiIdx = headers.indexOf('AI圖');
      const promptIdx = headers.indexOf('Prompt 核心關鍵字');
      const promptIdx2 = headers.indexOf('Prompt核心關鍵字');
      const realPromptIdx = promptIdx >= 0 ? promptIdx : promptIdx2;
      const refImgIdx = headers.indexOf('產品圖');
      const hookIdx = headers.indexOf('首句 Hook 內容') >= 0 ? headers.indexOf('首句 Hook 內容') : headers.indexOf('首句Hook');
      const noIdx = headers.indexOf('編號') >= 0 ? headers.indexOf('編號') : headers.indexOf('#');

      if (aiIdx < 0 || realPromptIdx < 0) continue;

      let candidate = 0, already = 0;
      ws.eachRow((row, rowNum) => {
        if (rowNum === 1) return;
        const vals = row.values.slice(1);
        const prompt = String(vals[realPromptIdx] || '').trim();
        const existingAi = String(vals[aiIdx] || '').trim();
        const refImg = String(vals[refImgIdx] || '').trim();
        if (!prompt) return;
        if (existingAi) { already++; return; }
        candidate++;
        const hook = String(vals[hookIdx] || '').trim();
        const no = String(vals[noIdx] || '').trim();
        tasks.push({
          sheetName: ws.name,
          rowNumber: rowNum,
          aiColLetter: colNumToLetter(aiIdx + 1),
          prompt: [prompt, hook && `Main text: "${hook}"`, `Brand vibe: ${brand}`].filter(Boolean).join('. '),
          refUrl: refImg,
          displayName: no ? `${ws.name} #${no}` : `${ws.name} row ${rowNum}`,
        });
      });
      sheetsScanned.push({ name: ws.name, candidates: candidate, already });
    }

    return NextResponse.json({
      brand,
      xlsx_url: up.url,
      tasks,
      sheets: sheetsScanned,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message, stack: process.env.DEBUG ? e.stack : undefined }, { status: 500 });
  }
}

function colNumToLetter(n) {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
