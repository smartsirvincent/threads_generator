// 拼裝最終 xlsx + 上傳 Cloudinary。不打 LLM/KIE,~3 秒回 URL
import { NextResponse } from 'next/server';
import { writeWorkbookBuffer } from '@/lib/excel-writer.js';
import { uploadRawToCloudinary, hasCloudinary } from '@/lib/cloudinary.js';
import { normalizeInput } from '@/lib/normalize.js';
import { randomUUID } from 'node:crypto';

export const runtime = 'nodejs';
export const maxDuration = 30;

// In-memory fallback (本機 dev 用,serverless 不可靠)
const STORE = globalThis.__threadsGenStore ?? new Map();
globalThis.__threadsGenStore = STORE;

export async function POST(req) {
  try {
    const { input: rawInput, themes, postsByTheme: rawPostsByTheme } = await req.json();
    const input = normalizeInput(rawInput);

    const postsByTheme = new Map(Object.entries(rawPostsByTheme || {}));
    // start_date 是 optional;沒提供就傳 null 讓 excel-writer 把發文時間欄留空
    const startDate = input.start_date ? new Date(input.start_date) : null;

    const xlsxBuffer = await writeWorkbookBuffer({
      input,
      themes,
      postsByTheme,
      startDate,
    });

    const safeName = (input.brand || 'untitled').replace(/[^\w一-龥-]/g, '_').slice(0, 40);
    let downloadUrl = null;

    if (hasCloudinary()) {
      try {
        const up = await uploadRawToCloudinary(xlsxBuffer, {
          folder: `threads-generator/${sanitize(input.brand)}`,
          filename: `${safeName}.xlsx`,
        });
        downloadUrl = up.url;
      } catch (e) {
        // fallback 走下面
      }
    }

    let id = null;
    if (!downloadUrl) {
      id = randomUUID();
      STORE.set(id, {
        buffer: xlsxBuffer,
        name: `${safeName}.xlsx`,
        size: xlsxBuffer.length,
        createdAt: Date.now(),
      });
    }

    return NextResponse.json({
      id,
      download_url: downloadUrl,
      file_size: xlsxBuffer.length,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message, stack: process.env.DEBUG ? e.stack : undefined }, { status: 500 });
  }
}

function sanitize(s) {
  return String(s || 'untitled').replace(/[^\w\-]/g, '_').slice(0, 40);
}
