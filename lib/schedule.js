// 排程解析器:把「每日下午4點」「每週2、5晚上8點半」轉成 Date 陣列

const CHINESE_DIGITS = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 7, 天: 7, 七: 7 };

function parseHour(period, hourStr, halfHour) {
  let h = parseInt(hourStr, 10);
  if (Number.isNaN(h)) {
    // 中文數字
    h = CHINESE_DIGITS[hourStr] || 9;
  }
  if (period === '下午' || period === '晚上') {
    if (h < 12) h += 12;
  } else if (period === '凌晨') {
    // h 不變
  } else if (period === '上午' || period === '早上') {
    if (h === 12) h = 0;
  }
  return { hour: h, minute: halfHour ? 30 : 0 };
}

/**
 * 解析排程字串。回傳 { daysOfWeek: number[] | null, hour, minute }
 * - daysOfWeek: null = 每日,[1..7] = 週一..週日
 */
export function parseSchedule(scheduleStr) {
  const s = scheduleStr || '每日下午4點';

  let daysOfWeek = null;
  // 每週 N、M、K... 或 每週N(支援中文/阿拉伯混合,用、,，分隔)
  // greedy match 所有合法日字元,遇到時段詞(上/下/晚/凌/早)就停
  const weekMatch = s.match(/每週([\d一二三四五六日天、,，\s]+)/);
  if (weekMatch) {
    const daysPart = weekMatch[1];
    daysOfWeek = [];
    for (const ch of daysPart) {
      if (/\d/.test(ch)) daysOfWeek.push(parseInt(ch, 10));
      else if (CHINESE_DIGITS[ch]) daysOfWeek.push(CHINESE_DIGITS[ch]);
    }
    if (daysOfWeek.length === 0) daysOfWeek = null;
  }

  // 時間部分:上午/下午/晚上/凌晨 X 點(半)
  const timeMatch = s.match(/(上午|下午|晚上|凌晨|早上)?(\d+|[一二三四五六七八九十])\s*點\s*(半)?/);
  let hour = 16, minute = 0;
  if (timeMatch) {
    const period = timeMatch[1] || '下午';
    const result = parseHour(period, timeMatch[2], !!timeMatch[3]);
    hour = result.hour;
    minute = result.minute;
  }

  return { daysOfWeek, hour, minute };
}

/**
 * 從 startDate 開始,依排程產生 count 個 Date
 */
export function generateScheduleDates({ scheduleStr, count, startDate }) {
  const sched = parseSchedule(scheduleStr);
  const result = [];
  const cursor = new Date(startDate);
  cursor.setHours(sched.hour, sched.minute, 0, 0);

  let safety = 0;
  while (result.length < count && safety < count * 14) {
    const dayOfWeek = cursor.getDay() === 0 ? 7 : cursor.getDay(); // Mon=1..Sun=7
    if (sched.daysOfWeek === null || sched.daysOfWeek.includes(dayOfWeek)) {
      result.push(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
    safety++;
  }
  return result;
}

export function formatDateTime(date) {
  if (!date) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}:00`;
}
