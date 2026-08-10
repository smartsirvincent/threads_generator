// 成效分析:讀發文 log,依「主題」彙整;若有 Threads 權杖則抓每篇 insights(views/likes/replies)
import { NextResponse } from 'next/server';
import { listRawResources, hasAdminCloudinary } from '@/lib/cloudinary.js';

export const runtime = 'nodejs';
export const maxDuration = 60;

const LOG_PREFIX = 'threads-generator/postlog/';
const BASE = 'https://graph.threads.net/v1.0';
const TYPE_LABEL = { text: '純文字', long: '長文', image: '圖片' };

async function readLog() {
  if (!hasAdminCloudinary()) return [];
  const list = await listRawResources({ prefix: LOG_PREFIX });
  const match = list.find((r) => (r.public_id || '').includes('best-friend'));
  if (!match?.secure_url) return [];
  const r = await fetch(match.secure_url, { cache: 'no-store' });
  if (!r.ok) return [];
  const d = await r.json();
  return Array.isArray(d.entries) ? d.entries : [];
}

async function fetchInsights(mediaId, token) {
  try {
    const qs = new URLSearchParams({ metric: 'views,likes,replies,reposts,quotes', access_token: token }).toString();
    const r = await fetch(`${BASE}/${mediaId}/insights?${qs}`);
    const d = await r.json();
    const out = { views: 0, likes: 0, replies: 0, reposts: 0, quotes: 0 };
    for (const m of (d.data || [])) {
      const v = m?.values?.[0]?.value ?? m?.total_value?.value ?? 0;
      if (m.name in out) out[m.name] = Number(v) || 0;
    }
    return out;
  } catch (_) { return null; }
}

export async function GET() {
  try {
    const entries = await readLog();
    const token = process.env.THREADS_ACCESS_TOKEN;
    const hasInsights = !!token;

    // 只對最近 60 篇抓 insights(避免逾時)
    const recent = entries.slice(0, 60);
    const insightsMap = {};
    if (hasInsights) {
      const CONC = 5;
      for (let i = 0; i < recent.length; i += CONC) {
        const chunk = recent.slice(i, i + CONC);
        const res = await Promise.all(chunk.map((e) => e.mediaId ? fetchInsights(e.mediaId, token) : Promise.resolve(null)));
        chunk.forEach((e, j) => { if (res[j]) insightsMap[e.mediaId] = res[j]; });
      }
    }

    // 依主題彙整
    const byTopicMap = new Map();
    for (const e of entries) {
      const key = e.topicName || '(未指定主題)';
      if (!byTopicMap.has(key)) {
        byTopicMap.set(key, { topicName: key, type: e.type || '', count: 0, lastTs: 0, views: 0, likes: 0, replies: 0, reposts: 0, quotes: 0, measured: 0 });
      }
      const row = byTopicMap.get(key);
      row.count += 1;
      if ((e.ts || 0) > row.lastTs) { row.lastTs = e.ts || 0; row.type = e.type || row.type; }
      const ins = insightsMap[e.mediaId];
      if (ins) {
        row.views += ins.views; row.likes += ins.likes; row.replies += ins.replies;
        row.reposts += ins.reposts; row.quotes += ins.quotes; row.measured += 1;
      }
    }
    const byTopic = Array.from(byTopicMap.values())
      .map((r) => ({ ...r, typeLabel: TYPE_LABEL[r.type] || r.type, engagement: r.likes + r.replies + r.reposts + r.quotes }))
      .sort((a, b) => (hasInsights ? b.views - a.views : b.count - a.count));

    return NextResponse.json({
      hasInsights,
      totalPosts: entries.length,
      byTopic,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message, byTopic: [], totalPosts: 0, hasInsights: false }, { status: 200 });
  }
}
