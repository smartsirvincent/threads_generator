// SSE-like streaming endpoint
// 每行一個 JSON event,用 ReadableStream 推
import { randomUUID } from 'node:crypto';

import { generateThemePosts, generateThemePostsDryRun } from '@/lib/generate-posts.js';
import { writeWorkbookBuffer } from '@/lib/excel-writer.js';
import { getPostType } from '@/lib/schemas.js';
import { generateBatch as kieGenerateBatch } from '@/lib/kie-image.js';
import { uploadToCloudinary, uploadRawToCloudinary, hasCloudinary } from '@/lib/cloudinary.js';
import { normalizeInput } from '@/lib/normalize.js';

export const runtime = 'nodejs';
// Hobby plan cap = 300s. Pro/Enterprise 可拉到 800s。
export const maxDuration = 300;

// 暫存 xlsx 用的 in-memory map(serverless 不可靠,但本機/單實例 OK)
const STORE = globalThis.__threadsGenStore ?? new Map();
globalThis.__threadsGenStore = STORE;

export async function POST(req) {
  const { input: rawInput, themes } = await req.json();
  const input = normalizeInput(rawInput);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (ev) => {
        controller.enqueue(encoder.encode(JSON.stringify(ev) + '\n'));
      };

      try {
        const postsByTheme = new Map();
        const themesSummary = [];

        for (let i = 0; i < themes.length; i++) {
          const theme = themes[i];
          emit({
            type: 'theme_start',
            theme: theme.name,
            index: i + 1,
            total: themes.length,
            target: theme.monthly_count || 30,
          });

          let posts = [];
          let failures = 0;

          if (input.dry_run) {
            posts = generateThemePostsDryRun({ theme, input });
          } else {
            posts = await generateThemePosts({
              theme,
              input,
              onProgress: (p) => {
                if (p.phase === 'batch') {
                  emit({
                    type: 'batch',
                    theme: theme.name,
                    batch: p.batch,
                    batches: p.batches,
                    posts: p.posts,
                    target: p.target,
                  });
                }
              },
            });
          }

          // 從 posts 中找近期樣本送一筆出去
          if (posts.length > 0) {
            const last = posts[posts.length - 1];
            const preview = (last.文案內容 || last.貼文內容 || last.題目 || JSON.stringify(last)).slice(0, 200);
            emit({
              type: 'sample',
              theme: theme.name,
              index: posts.length,
              preview,
            });
          }

          postsByTheme.set(theme.name, posts);
          const t = getPostType(theme.type);
          themesSummary.push({
            name: theme.name,
            type: theme.type,
            type_label: t.label,
            count: posts.length,
            target: theme.monthly_count || 30,
            failures,
          });

          emit({
            type: 'theme_done',
            theme: theme.name,
            count: posts.length,
            target: theme.monthly_count || 30,
          });
        }

        // ===== 圖片生成階段 (KIE GPT Image 2 → Cloudinary) =====
        const wantImages = input.generate_images !== false && !input.dry_run;
        const imageTasks = []; // [{ themeName, postIndex, prompt, refs, size }]
        if (wantImages) {
          for (const [themeName, posts] of postsByTheme.entries()) {
            const theme = themes.find((t) => t.name === themeName);
            if (theme?.type !== 'product_with_image') continue;
            posts.forEach((post, pIdx) => {
              // 用 post.product_index 對應到具體 SKU 的圖片當參考
              const pi = clampProductIndex(post.product_index, input.products.length);
              const product = input.products[pi];
              const prompt = buildImagePrompt(post, input, product);
              if (!prompt) return;
              imageTasks.push({
                themeName,
                postIndex: pIdx,
                prompt,
                refs: pickRefs(product?.images && product.images.length > 0 ? product.images : input.product_images),
                size: '1:1',
              });
            });
          }
        }

        if (wantImages && imageTasks.length > 0) {
          emit({ type: 'images_start', total: imageTasks.length });
          if (!hasCloudinary()) {
            emit({
              type: 'images_warning',
              message: 'CLOUDINARY 未設定,圖片 URL 會直接寫 KIE (20 分鐘失效)',
            });
          }

          const kieResults = await kieGenerateBatch(
            imageTasks.map((t) => ({ prompt: t.prompt, referenceImages: t.refs, size: t.size })),
            {
              concurrency: 4,
              onProgress: ({ done, total, index, ok, error }) => {
                emit({
                  type: 'image_progress',
                  done,
                  total,
                  theme: imageTasks[index]?.themeName,
                  ok,
                  error,
                });
              },
            }
          );

          // 把 KIE 結果上傳到 Cloudinary (或直接寫 KIE URL)
          for (let i = 0; i < kieResults.length; i++) {
            const r = kieResults[i];
            const t = imageTasks[i];
            const posts = postsByTheme.get(t.themeName);
            if (!posts || !posts[t.postIndex]) continue;

            if (r.error) {
              posts[t.postIndex].AI圖 = '';
              posts[t.postIndex]._image_error = r.error;
              continue;
            }

            let finalUrl = r.kieUrl;
            if (hasCloudinary() && r.buffer) {
              try {
                const up = await uploadToCloudinary(r.buffer, {
                  folder: `threads-generator/${sanitizeFolder(input.brand)}`,
                });
                finalUrl = up.url;
              } catch (e) {
                emit({ type: 'upload_warning', theme: t.themeName, error: e.message });
                // 退回到 KIE URL (20 分鐘有效)
              }
            }
            posts[t.postIndex].AI圖 = finalUrl;
            emit({
              type: 'image_uploaded',
              theme: t.themeName,
              index: t.postIndex + 1,
              url: finalUrl,
            });
          }

          emit({ type: 'images_done' });
        }

        emit({ type: 'writing_xlsx' });

        const id = randomUUID();
        const safeName = (input.brand || 'untitled').replace(/[^\w一-龥-]/g, '_').slice(0, 40);
        const startDate = input.start_date ? new Date(input.start_date) : null;

        const cleanedInput = {
          ...input,
          product_images: Array.isArray(input.product_images) ? input.product_images : [],
        };

        const xlsxBuffer = await writeWorkbookBuffer({
          input: cleanedInput,
          themes,
          postsByTheme,
          startDate,
        });

        // serverless 友善:直接上傳到 Cloudinary 拿永久 URL,不寫本機檔
        let downloadUrl = null;
        if (hasCloudinary()) {
          try {
            const up = await uploadRawToCloudinary(xlsxBuffer, {
              folder: `threads-generator/${sanitizeFolder(input.brand)}`,
              filename: `${safeName}.xlsx`,
            });
            downloadUrl = up.url;
          } catch (e) {
            emit({ type: 'upload_warning', message: `xlsx 上傳 Cloudinary 失敗,fall back 到本機: ${e.message}` });
          }
        }

        // fallback:沒 Cloudinary 或上傳失敗 → 存 in-memory(本機 dev 才會用到)
        if (!downloadUrl) {
          STORE.set(id, {
            buffer: xlsxBuffer,
            name: `${safeName}.xlsx`,
            size: xlsxBuffer.length,
            createdAt: Date.now(),
          });
        }

        emit({
          type: 'done',
          id,
          download_url: downloadUrl,
          file_size: xlsxBuffer.length,
          themes_summary: themesSummary,
        });
      } catch (e) {
        emit({ type: 'error', message: e.message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'application/x-ndjson',
      'cache-control': 'no-cache, no-transform',
      'x-accel-buffering': 'no',
    },
  });
}

function buildImagePrompt(post, input, product) {
  const keywords = post['Prompt核心關鍵字'] || post['Prompt 核心關鍵字'] || '';
  const main = post['主標題'] || post['首句Hook'] || '';
  const sub = post['副標題'] || post['切入點'] || '';
  const persona = input.brand_persona || '';
  if (!keywords && !main) return null;
  return [
    product?.name && `SKU: ${product.name}`,
    keywords,
    main && `Main text: "${main}"`,
    sub && `Sub: "${sub}"`,
    `Brand vibe: ${input.brand}, ${persona.slice(0, 60)}`,
    'Photorealistic, social media post style, vibrant lighting',
  ].filter(Boolean).join('. ');
}

function pickRefs(images) {
  if (!Array.isArray(images) || images.length === 0) return [];
  const shuffled = [...images].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 2);
}

function clampProductIndex(idx, total) {
  if (!Number.isInteger(idx) || idx < 0 || idx >= total) return 0;
  return idx;
}

function sanitizeFolder(s) {
  return String(s || 'untitled').replace(/[^\w\-]/g, '_').slice(0, 40);
}
