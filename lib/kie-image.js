// KIE GPT Image 2 wrapper
// docs: https://docs.kie.ai/4o-image-api/
//
// 流程: POST /generate → 拿 taskId → 輪詢 /record-info → successFlag=1 拿 URL → 下載 bytes
// 注意: 生成 URL 只活 20 分鐘,要立即下載/轉存

const KIE_BASE = 'https://api.kie.ai/api/v1';
const POLL_INTERVAL_MS = 3000;
const POLL_MAX_ATTEMPTS = 60; // 60 * 3s = 3 分鐘 timeout

function key() {
  const k = process.env.KIE_API_KEY;
  if (!k) throw new Error('KIE_API_KEY not set in .env');
  return k;
}

async function postJSON(path, body) {
  const res = await fetch(`${KIE_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`KIE ${path} HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

async function getJSON(path) {
  const res = await fetch(`${KIE_BASE}${path}`, {
    headers: { 'Authorization': `Bearer ${key()}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`KIE ${path} HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

/**
 * 觸發圖片生成,回傳 taskId
 */
export async function submitImage({ prompt, referenceImages = [], size = '1:1', enhance = false }) {
  const body = {
    prompt,
    size,
    isEnhance: enhance,
  };
  if (referenceImages.length > 0) {
    body.filesUrl = referenceImages.slice(0, 5);
  }
  const resp = await postJSON('/gpt4o-image/generate', body);
  if (resp.code !== 200 || !resp.data?.taskId) {
    throw new Error(`KIE submit failed: ${resp.msg || JSON.stringify(resp)}`);
  }
  return resp.data.taskId;
}

/**
 * 輪詢直到完成,回傳第一張圖片 URL
 */
export async function pollImage(taskId) {
  for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
    const resp = await getJSON(`/gpt4o-image/record-info?taskId=${taskId}`);
    const d = resp.data;
    if (!d) {
      // 剛 submit 完可能還沒有 record,等等再試
      await sleep(POLL_INTERVAL_MS);
      continue;
    }
    if (d.successFlag === 1) {
      const urls = d.response?.result_urls || d.response?.resultUrls;
      if (urls && urls.length > 0) return urls[0];
      throw new Error(`KIE done but no URL: ${JSON.stringify(d)}`);
    }
    if (d.successFlag === 2) {
      throw new Error(`KIE generation failed: ${d.errorMessage || d.errorCode || 'unknown'}`);
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(`KIE poll timeout after ${POLL_MAX_ATTEMPTS * POLL_INTERVAL_MS / 1000}s`);
}

/**
 * 下載圖片為 Buffer
 */
export async function downloadImage(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download HTTP ${res.status} for ${url}`);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

/**
 * 一次跑完: submit → poll → download
 */
export async function generateAndDownload(opts) {
  const taskId = await submitImage(opts);
  const url = await pollImage(taskId);
  const buf = await downloadImage(url);
  return { taskId, kieUrl: url, buffer: buf };
}

// ===================================================================
// V2: 新版 endpoint /api/v1/jobs/createTask (model gpt-image-2-image-to-image)
// 支援更多 aspect_ratio: 1:1, 16:9, 9:16, 4:3, 3:4, 5:4, 4:5, 2:1, 1:2, 21:9, 9:21 等
// ===================================================================

const KIE_V2_MODEL = 'gpt-image-2-image-to-image';
const SUPPORTED_AR = new Set(['auto','1:1','3:2','2:3','4:3','3:4','5:4','4:5','16:9','9:16','2:1','1:2','3:1','1:3','21:9','9:21']);

/**
 * 觸發 V2 圖片生成,回傳 taskId
 */
export async function submitImageV2({ prompt, referenceImages = [], aspect_ratio = '1:1', resolution }) {
  if (!SUPPORTED_AR.has(aspect_ratio)) {
    throw new Error(`KIE V2 不支援 aspect_ratio: ${aspect_ratio}`);
  }
  const body = {
    model: KIE_V2_MODEL,
    input: {
      prompt,
      input_urls: referenceImages.slice(0, 16),
      aspect_ratio,
    },
  };
  if (resolution) body.input.resolution = resolution;

  const resp = await postJSON('/jobs/createTask', body);
  if (resp.code !== 200 || !resp.data?.taskId) {
    throw new Error(`KIE V2 submit failed: ${resp.msg || JSON.stringify(resp)}`);
  }
  return resp.data.taskId;
}

/**
 * V2 輪詢直到完成,回傳第一張結果 URL
 */
export async function pollImageV2(taskId) {
  for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
    const resp = await getJSON(`/jobs/recordInfo?taskId=${taskId}`);
    const d = resp.data;
    if (!d) {
      await sleep(POLL_INTERVAL_MS);
      continue;
    }
    if (d.state === 'success') {
      try {
        const r = JSON.parse(d.resultJson || '{}');
        const urls = r.resultUrls || r.result_urls;
        if (urls && urls.length > 0) return urls[0];
        throw new Error(`KIE V2 done but no URL: ${d.resultJson}`);
      } catch (e) {
        throw new Error(`KIE V2 parse resultJson: ${e.message}`);
      }
    }
    if (d.state === 'fail') {
      throw new Error(`KIE V2 generation failed: ${d.failMsg || d.failCode || 'unknown'}`);
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(`KIE V2 poll timeout`);
}

/**
 * V2 一次跑完
 */
export async function generateAndDownloadV2(opts) {
  const taskId = await submitImageV2(opts);
  const url = await pollImageV2(taskId);
  const buf = await downloadImage(url);
  return { taskId, kieUrl: url, buffer: buf };
}

/**
 * 並行跑多張,有 concurrency 上限
 * tasks: [{ prompt, referenceImages, size }, ...]
 * onProgress: ({ done, total, index, ok, error }) => void
 */
export async function generateBatch(tasks, { concurrency = 5, onProgress } = {}) {
  const results = new Array(tasks.length);
  let done = 0;
  let cursor = 0;

  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= tasks.length) return;
      try {
        results[i] = await generateAndDownload(tasks[i]);
        done++;
        onProgress?.({ done, total: tasks.length, index: i, ok: true });
      } catch (e) {
        results[i] = { error: e.message };
        done++;
        onProgress?.({ done, total: tasks.length, index: i, ok: false, error: e.message });
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
