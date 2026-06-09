// 補圖 finalize:從 Cloudinary 抓原 xlsx,注入圖片 URL,重新上傳
import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { uploadRawToCloudinary } from '@/lib/cloudinary.js';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req) {
  try {
    const { xlsx_url, brand, results } = await req.json();
    if (!xlsx_url) {
      return NextResponse.json({ error: 'xlsx_url required' }, { status: 400 });
    }
    if (!Array.isArray(results)) {
      return NextResponse.json({ error: 'results array required' }, { status: 400 });
    }

    // 下載原 xlsx
    const res = await fetch(xlsx_url);
    if (!res.ok) {
      return NextResponse.json({ error: `下載原 xlsx 失敗 HTTP ${res.status}` }, { status: 502 });
    }
    const buffer = Buffer.from(await res.arrayBuffer());

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);

    let written = 0;
    let skipped = 0;
    for (const r of results) {
      if (!r.url || !r.sheetName || !r.aiColLetter || !r.rowNumber) { skipped++; continue; }
      const ws = wb.getWorksheet(r.sheetName);
      if (!ws) { skipped++; continue; }
      ws.getCell(`${r.aiColLetter}${r.rowNumber}`).value = r.url;
      written++;
    }

    // 重新輸出 + 上傳
    const newBuffer = Buffer.from(await wb.xlsx.writeBuffer());
    const safeName = (brand || 'untitled').replace(/[^\w一-龥-]/g, '_').slice(0, 40);
    const up = await uploadRawToCloudinary(newBuffer, {
      folder: `threads-generator/${sanitize(brand)}`,
      filename: `${safeName}-with-images.xlsx`,
    });

    return NextResponse.json({
      download_url: up.url,
      file_size: newBuffer.length,
      written,
      skipped,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message, stack: process.env.DEBUG ? e.stack : undefined }, { status: 500 });
  }
}

function sanitize(s) {
  return String(s || 'untitled').replace(/[^\w\-]/g, '_').slice(0, 40);
}
