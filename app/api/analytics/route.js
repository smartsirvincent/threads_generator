// 成效分析:讀發文 log,依期間 + 型態 + 主題彙整;有 Threads 權杖則抓每篇 insights
import { NextResponse } from 'next/server';
import { readPostLog } from '@/lib/threads.js';

export const runtime = 'nodejs';
export const maxDuration = 300;

const BASE = 'https://graph.threads.net/v1.0';
const TYPE_LABEL = { text: '純文字', long: '長文', image: '圖片' };

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

function emptyMetrics() { return { views: 0, likes: 0, replies: 0, reposts: 0, quotes: 0, engagement: 0, count: 0, measured: 0 }; }
function addMetrics(row, ins) {
  row.views += ins.views; row.likes += ins.likes; row.replies += ins.replies;
  row.reposts += ins.reposts; row.quotes += ins.quotes;
  row.engagement += ins.likes + ins.replies + ins.reposts + ins.quotes;
  row.measured += 1;
}
function withRate(row) {
  return { ...row, rate: row.views > 0 ? +(row.engagement / row.views * 100).toFixed(1) : 0 };
}

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const now = Date.now();
    const from = Number(url.searchParams.get('from')) || (now - 30 * 86400000);
    const to = Number(url.searchParams.get('to')) || now;
    const token = process.env.THREADS_ACCESS_TOKEN;
    const hasInsights = !!token;

    const all = await readPostLog();
    const inRange = all.filter((e) => (e.ts || 0) >= from && (e.ts || 0) <= to);

    // 抓 insights(上限 80 篇,避免逾時)
    const capped = inRange.slice(0, 80);
    const insMap = {};
    if (hasInsights) {
      const CONC = 5;
      for (let i = 0; i < capped.length; i += CONC) {
        const chunk = capped.slice(i, i + CONC);
        const res = await Promise.all(chunk.map((e) => e.mediaId ? fetchInsights(e.mediaId, token) : Promise.resolve(null)));
        chunk.forEach((e, j) => { if (res[j]) insMap[e.mediaId] = res[j]; });
      }
    }

    const byType = {}; const byTopic = {}; const posts = [];
    for (const e of inRange) {
      const tk = e.type || 'text'; const pk = e.topicName || '(未指定)';
      if (!byType[tk]) byType[tk] = emptyMetrics();
      if (!byTopic[pk]) byTopic[pk] = emptyMetrics();
      byType[tk].count += 1; byTopic[pk].count += 1;
      const ins = insMap[e.mediaId];
      if (ins) {
        addMetrics(byType[tk], ins); addMetrics(byTopic[pk], ins);
        posts.push({ ...ins, engagement: ins.likes + ins.replies + ins.reposts + ins.quotes, topicName: pk, type: tk, ts: e.ts, permalink: e.permalink, textPreview: e.textPreview });
      }
    }

    const byTypeArr = Object.entries(byType).map(([type, m]) => ({ type, typeLabel: TYPE_LABEL[type] || type, ...withRate(m) })).sort((a, b) => b.views - a.views);
    const byTopicArr = Object.entries(byTopic).map(([topicName, m]) => ({ topicName, ...withRate(m) })).sort((a, b) => (hasInsights ? b.views - a.views : b.count - a.count));
    const topPosts = posts.map((p) => ({ ...p, rate: p.views > 0 ? +(p.engagement / p.views * 100).toFixed(1) : 0 }))
      .sort((a, b) => b.views - a.views).slice(0, 10);

    const totals = withRate(inRange.reduce((acc, e) => {
      acc.count += 1; const ins = insMap[e.mediaId]; if (ins) addMetrics(acc, ins); return acc;
    }, emptyMetrics()));

    return NextResponse.json({ hasInsights, from, to, totals, byType: byTypeArr, byTopic: byTopicArr, topPosts });
  } catch (e) {
    return NextResponse.json({ error: e.message, byType: [], byTopic: [], topPosts: [], totals: null, hasInsights: false }, { status: 200 });
  }
}
