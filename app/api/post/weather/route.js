// 預約發文:抓曼谷當天天氣(Open-Meteo,免金鑰),依天氣產出「注意事項 + 保養事宜」貼文
import { NextResponse } from 'next/server';
import { callJSON } from '@/lib/llm.js';
import { clinicContextText } from '@/lib/verticals.js';
import { sanitizeText } from '@/lib/post-writer.js';

export const runtime = 'nodejs';
export const maxDuration = 60;

const WMO = {
  0: '晴朗', 1: '大致晴朗', 2: '局部多雲', 3: '陰天', 45: '有霧', 48: '霧',
  51: '毛毛雨', 53: '毛毛雨', 55: '毛毛雨', 56: '凍雨', 57: '凍雨',
  61: '小雨', 63: '中雨', 65: '大雨', 66: '凍雨', 67: '凍雨',
  71: '下雪', 73: '下雪', 75: '大雪', 77: '雪珠',
  80: '陣雨', 81: '陣雨', 82: '強陣雨', 85: '陣雪', 86: '陣雪',
  95: '雷雨', 96: '雷雨夾冰雹', 99: '強雷雨',
};

async function fetchBangkokWeather() {
  const url = 'https://api.open-meteo.com/v1/forecast?' + new URLSearchParams({
    latitude: '13.7563', longitude: '100.5018',
    current: 'temperature_2m,relative_humidity_2m,weather_code,precipitation',
    daily: 'temperature_2m_max,temperature_2m_min,uv_index_max,precipitation_probability_max,weather_code',
    timezone: 'Asia/Bangkok', forecast_days: '1',
  }).toString();
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error('天氣 API 失敗 HTTP ' + r.status);
  const d = await r.json();
  const cur = d.current || {}; const day = d.daily || {};
  const code = (day.weather_code?.[0]) ?? cur.weather_code ?? 0;
  const num = (x) => (x === null || x === undefined ? null : Math.round(Number(x)));
  return {
    tempNow: num(cur.temperature_2m),
    humidity: num(cur.relative_humidity_2m),
    tempMax: num(day.temperature_2m_max?.[0]),
    tempMin: num(day.temperature_2m_min?.[0]),
    uvMax: day.uv_index_max?.[0] != null ? Math.round(Number(day.uv_index_max[0]) * 10) / 10 : null,
    precipProb: num(day.precipitation_probability_max?.[0]),
    desc: WMO[code] || '多雲',
  };
}

const SYSTEM = `你是醫美診所「泰國醫美 Best Friend」的社群文案,口吻像親暱真誠的閨蜜(用「妳」稱呼)。
請依「曼谷當天天氣」寫一則貼文,重點是**依天氣給出實用的注意事項與保養/術後照護建議**,並自然扣回診所(可提療程、每人 5,000 醫美券直接抵、來曼谷變美順便玩)。
天氣對應要點(依實際數據挑重點,不要全塞):
- 紫外線 UV 高(≥8):術後/雷射/音波後嚴格防曬、補擦、撐傘遮陽、避免正午曝曬。
- 高溫(≥34):補水保濕、避免曝曬中暑、剛做完療程避免高溫悶熱。
- 高濕度(≥75)或有雨:悶熱易出油/悶痘、注意清潔與清爽保濕、外出攜傘。
- 涼爽乾爽:適合安排療程、把握好天氣出遊拍照。
規則:繁體中文、口語、有溫度;醫療合規(不用保證見效/永久/最便宜/第一);120-260 字,開頭有 hook,結尾軟性 CTA + 2-4 hashtag(含 #曼谷天氣 之類)。
格式:Threads 是純文字,禁止使用任何 markdown 符號(不要 ** 粗體、__、# 標題、> 引用、\`\`\`);要強調用文字或 emoji。
輸出 JSON(嚴格):{"text":"完整貼文(含換行與 hashtag)"}`;

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { brand, brand_persona, audience, clinic } = body;
    const wx = await fetchBangkokWeather();
    const clinicText = clinicContextText(clinic);
    const wxLine = [
      `天氣:${wx.desc}`,
      wx.tempNow != null ? `目前 ${wx.tempNow}°C` : '',
      (wx.tempMin != null && wx.tempMax != null) ? `今日 ${wx.tempMin}–${wx.tempMax}°C` : '',
      wx.humidity != null ? `濕度 ${wx.humidity}%` : '',
      wx.uvMax != null ? `紫外線最高 UV ${wx.uvMax}` : '',
      wx.precipProb != null ? `降雨機率 ${wx.precipProb}%` : '',
    ].filter(Boolean).join('、');
    const user = `**曼谷今日天氣**: ${wxLine}
**診所**: ${brand || '泰國醫美 Best Friend'}
**口吻**: ${brand_persona || '閨蜜、真誠、務實'}
**受眾**: ${audience || '20-45 歲、想到曼谷旅遊順便變美的台灣女性'}
${clinicText ? `**診所資訊**:\n${clinicText}` : ''}

請依上面的天氣寫一則「天氣提醒 + 保養/術後照護」貼文,直接回 JSON。`;
    const parsed = await callJSON({ system: SYSTEM, user, maxTokens: 1200, temperature: 0.9 });
    let text = sanitizeText(parsed.text);
    if (text.length > 500) text = text.slice(0, 498) + '…';
    return NextResponse.json({ weather: wx, weatherLine: wxLine, text });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
