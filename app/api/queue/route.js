// 排程佇列:待發貼文清單(存 Cloudinary 固定槽)。GET 列出;POST 依 action 增/刪。
import { NextResponse } from 'next/server';
import { readQueue, writeQueue, readPriceChanges, publishThreads, appendPostLog, readTopics } from '@/lib/threads.js';
import { hasCloudinary } from '@/lib/cloudinary.js';

export const runtime = 'nodejs';
export const maxDuration = 60;

const newId = () => `q-${Date.now()}-${Math.round(Math.random() * 1e6)}`;

// 排程一律用台北時區判斷(伺服器跑 UTC)
const TZ_MIN = 8 * 60;
const tzParts = (ts) => {
  const d = new Date(Number(ts) + TZ_MIN * 60000);
  return { weekday: d.getUTCDay(), time: d.toISOString().slice(11, 16) };
};
// 屬於某主題的貼文,只能排在該主題設定的指定時段
async function rejectOffSlot(add) {
  const needCheck = add.filter((x) => x.topicId);
  if (!needCheck.length) return null;
  const topics = await readTopics();
  for (const x of needCheck) {
    const tp = topics.find((t) => t.id === x.topicId);
    if (!tp) continue;
    const slots = (tp.schedule || []).filter((sl) => /^\d{2}:\d{2}$/.test(sl.time || ''));
    if (!slots.length) return `主題「${tp.name}」還沒有指定時段,不能排程。請先到排程頁設定週幾、幾點。`;
    const p = tzParts(x.scheduledTs);
    if (!slots.some((sl) => sl.weekday === p.weekday && sl.time === p.time)) {
      const WD = ['日', '一', '二', '三', '四', '五', '六'];
      return `主題「${tp.name}」只能排在指定時段,週${WD[p.weekday]} ${p.time} 不在設定內。`;
    }
  }
  return null;
}

// 對一段文字套用價格異動(舊→新),回 {text, changed, applied}
function applyChanges(text, changes) {
  let out = text; const applied = [];
  for (const c of changes) {
    if (c.from && out.includes(c.from)) { out = out.split(c.from).join(c.to); applied.push(c); }
  }
  return { text: out, changed: out !== text, applied };
}

export async function GET() {
  try {
    const items = await readQueue();
    items.sort((a, b) => (a.scheduledTs || 0) - (b.scheduledTs || 0));
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ items: [], error: e.message });
  }
}

export async function POST(req) {
  try {
    if (!hasCloudinary()) return NextResponse.json({ error: 'Cloudinary 未設定' }, { status: 503 });
    const body = await req.json();
    const action = body.action || 'add';
    let items = await readQueue();

    if (action === 'add') {
      const add = (body.items || [])
        .filter((x) => (x.text || '').trim())
        .map((x) => ({
          id: newId(),
          text: String(x.text).slice(0, 500),
          topicId: x.topicId || '', topicName: x.topicName || '', type: x.type || '',
          imageUrl: x.imageUrl || '',
          scheduledTs: Number(x.scheduledTs) || Date.now(),
          status: 'pending', mediaId: '', permalink: '', error: '',
        }));
      const bad = await rejectOffSlot(add);
      if (bad) return NextResponse.json({ error: bad }, { status: 400 });
      items = [...items, ...add];
      await writeQueue(items);
      return NextResponse.json({ ok: true, added: add.length, total: items.length });
    }
    if (action === 'remove') {
      items = items.filter((x) => x.id !== body.id);
      await writeQueue(items);
      return NextResponse.json({ ok: true, total: items.length });
    }
    if (action === 'clearPosted') {
      items = items.filter((x) => x.status !== 'posted');
      await writeQueue(items);
      return NextResponse.json({ ok: true, total: items.length });
    }
    if (action === 'update') {
      items = items.map((x) => x.id === body.id ? { ...x, ...body.patch } : x);
      await writeQueue(items);
      return NextResponse.json({ ok: true });
    }
    // 立即發送「單一」貼文(1 篇 1 篇發)
    if (action === 'postNow') {
      const it = items.find((x) => x.id === body.id);
      if (!it) return NextResponse.json({ error: '找不到該貼文' }, { status: 404 });
      if (it.status === 'posted') return NextResponse.json({ ok: true, already: true });
      try {
        const { mediaId, permalink } = await publishThreads(it.text, it.imageUrl || '');
        it.status = 'posted'; it.mediaId = mediaId; it.permalink = permalink; it.postedTs = Date.now(); it.error = '';
        await appendPostLog({ ts: it.postedTs, mediaId, permalink, topicId: it.topicId, topicName: it.topicName, type: it.type, textPreview: (it.text || '').slice(0, 60) });
        await writeQueue(items);
        return NextResponse.json({ ok: true, permalink });
      } catch (e) {
        it.status = 'failed'; it.error = String(e.message).slice(0, 200);
        await writeQueue(items);
        return NextResponse.json({ error: e.message }, { status: 500 });
      }
    }
    // 更新未發價格:預覽(哪些待發貼文會被改) / 套用
    if (action === 'refreshPreview') {
      const changes = (await readPriceChanges()).sort((a, b) => (a.ts || 0) - (b.ts || 0));
      const preview = [];
      for (const it of items) {
        if (it.status !== 'pending') continue;
        const r = applyChanges(it.text, changes);
        if (r.changed) preview.push({ id: it.id, topicName: it.topicName || '', scheduledTs: it.scheduledTs, before: it.text, after: r.text, applied: r.applied });
      }
      return NextResponse.json({ items: preview, changesCount: changes.length });
    }
    if (action === 'applyPrices') {
      const changes = (await readPriceChanges()).sort((a, b) => (a.ts || 0) - (b.ts || 0));
      const ids = new Set(body.ids || []);
      let updated = 0;
      items = items.map((it) => {
        if (it.status !== 'pending' || !ids.has(it.id)) return it;
        const r = applyChanges(it.text, changes);
        if (r.changed) { updated++; return { ...it, text: r.text }; }
        return it;
      });
      await writeQueue(items);
      return NextResponse.json({ ok: true, updated });
    }
    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
