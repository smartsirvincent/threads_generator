#!/usr/bin/env node
// 單張 smoke test: KIE 生成 → Cloudinary 上傳
import 'dotenv/config';
import fs from 'node:fs/promises';
import { generateAndDownload } from '../lib/kie-image.js';
import { uploadToCloudinary, hasCloudinary } from '../lib/cloudinary.js';

async function main() {
  console.log('🎨 KIE GPT Image 2 smoke test\n');

  const t0 = Date.now();
  console.log('1. 呼叫 KIE 生成...');
  const result = await generateAndDownload({
    prompt: 'A bowl of spicy Sichuan fish hotpot, steam rising, dramatic neon lighting, food photography, social media post style',
    size: '1:1',
  });
  console.log(`   ✅ taskId=${result.taskId}`);
  console.log(`   KIE URL: ${result.kieUrl}`);
  console.log(`   下載 ${result.buffer.length} bytes (${(Date.now() - t0) / 1000}s)`);

  // 暫存 local 看一下圖
  const localPath = `output/_smoke-${result.taskId.slice(-8)}.png`;
  await fs.mkdir('output', { recursive: true });
  await fs.writeFile(localPath, result.buffer);
  console.log(`   存到 ${localPath}\n`);

  if (!hasCloudinary()) {
    console.log('2. ⚠️  Cloudinary 未設定,跳過上傳');
    console.log('   請在 .env 加:');
    console.log('   (A) CLOUDINARY_UPLOAD_PRESET=ml_default (或你建的 preset)');
    console.log('   (B) CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET');
    return;
  }

  console.log('2. 上傳到 Cloudinary...');
  try {
    const up = await uploadToCloudinary(result.buffer, { folder: 'threads-generator/smoke-test' });
    console.log(`   ✅ ${up.url}`);
    console.log(`   public_id: ${up.publicId}`);
  } catch (e) {
    console.error(`   ❌ ${e.message}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('❌', e.message);
  if (process.env.DEBUG) console.error(e.stack);
  process.exit(1);
});
