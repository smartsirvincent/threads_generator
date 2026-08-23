// 成效分析:抓「帳號過去期間所有貼文」(含非本系統發的),依期間 + 型態 + 主題彙整並抓每篇 insights
import { NextResponse } from 'next/server';
import { readPostLog, getThreadsCreds } from '@/lib/threads.js';

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

// 抓帳號自己的貼文清單(不論是否經本系統發出),期間用 since/until(Unix 秒)
async function fetchAccountPosts(userId, token, from, to) {
  const out = [];
  let url = `${BASE}/${userId}/threads?` + new URLSearchParams({
    fields: 'id,timestamp,text,media_type,permalink',
    since: String(Math.floor(from / 1000)),
    until: String(Math.floor(to / 1000)),
    limit: '100',
    access_token: token,
  }).toString();
  for (let page = 0; page < 5 && url; page++) {
    const r = await fetch(url);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) break;
    for (const p of (d.data || [])) {
      const ts = Date.parse(p.timestamp) || 0;
      if (ts < from || ts > to) continue;
      out.push({ mediaId: p.id, ts, text: p.text || '', mediaType: p.media_type || '', permalink: p.permalink || '' });
    }
    url = d?.paging?.next || '';
  }
  return out;
}

function inferType(mediaType, text) {
  const mt = (mediaType || '').toUpperCase();
  if (mt === 'IMAGE' || mt === 'VIDEO' || mt === 'CAROUSEL_ALBUM' || mt === 'AUDIO') return 'image';
  return (text || '').length > 150 ? 'long' : 'text';
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
    const { userId, token } = await getThreadsCreds();
    const hasInsights = !!token;

    const log = await readPostLog();
    const logByMedia = {};
    for (const e of log) if (e.mediaId) logByMedia[e.mediaId] = e;

    // 優先用「帳號實際貼文清單」→ 才能涵蓋非本系統發的文;抓不到才退回本系統 log
    let entries = [];
    let coversAll = false;
    if (token && userId) {
      try {
        const acct = await fetchAccountPosts(userId, token, from, to);
        if (acct.length) {
          coversAll = true;
          entries = acct.map((p) => {
            const lg = logByMedia[p.mediaId];
            return {
              mediaId: p.mediaId, ts: p.ts, permalink: p.permalink,
              textPreview: (lg?.textPreview || p.text || '').slice(0, 60),
              type: lg?.type || inferType(p.mediaType, p.text),
              topicName: lg?.topicName || '(非本系統)',
              fromSystem: !!lg,
            };
          });
        }
      } catch (_) {}
    }
    if (!entries.length) {
      entries = log.filter((e) => (e.ts || 0) >= from && (e.ts || 0) <= to)
        .map((e) => ({ mediaId: e.mediaId, ts: e.ts, permalink: e.permalink, textPreview: e.textPreview, type: e.type || 'text', topicName: e.topicName || '(未指定)', fromSystem: true }));
    }
    entries.sort((a, b) => b.ts - a.ts);

    // 抓 insights(上限 80 篇,由新到舊,避免逾時)
    const capped = entries.slice(0, 80);
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
    for (const e of entries) {
      const tk = e.type || 'text'; const pk = e.topicName || '(未指定)';
      if (!byType[tk]) byType[tk] = emptyMetrics();
      if (!byTopic[pk]) byTopic[pk] = emptyMetrics();
      byType[tk].count += 1; byTopic[pk].count += 1;
      const ins = insMap[e.mediaId];
      if (ins) {
        addMetrics(byType[tk], ins); addMetrics(byTopic[pk], ins);
        posts.push({ ...ins, engagement: ins.likes + ins.replies + ins.reposts + ins.quotes, topicName: pk, type: tk, ts: e.ts, permalink: e.permalink, textPreview: e.textPreview, fromSystem: e.fromSystem });
      }
    }

    const byTypeArr = Object.entries(byType).map(([type, m]) => ({ type, typeLabel: TYPE_LABEL[type] || type, ...withRate(m) })).sort((a, b) => b.views - a.views);
    const byTopicArr = Object.entries(byTopic).map(([topicName, m]) => ({ topicName, ...withRate(m) })).sort((a, b) => (hasInsights ? b.views - a.views : b.count - a.count));
    const topPosts = posts.map((p) => ({ ...p, rate: p.views > 0 ? +(p.engagement / p.views * 100).toFixed(1) : 0 }))
      .sort((a, b) => b.views - a.views).slice(0, 10);

    const totals = withRate(entries.reduce((acc, e) => {
      acc.count += 1; const ins = insMap[e.mediaId]; if (ins) addMetrics(acc, ins); return acc;
    }, emptyMetrics()));

    return NextResponse.json({ hasInsights, coversAll, from, to, totals, byType: byTypeArr, byTopic: byTopicArr, topPosts });
  } catch (e) {
    return NextResponse.json({ error: e.message, byType: [], byTopic: [], topPosts: [], totals: null, hasInsights: false, coversAll: false }, { status: 200 });
  }
}
