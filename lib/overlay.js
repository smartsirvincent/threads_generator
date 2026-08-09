// Cloudinary 後製:把「真的 logo 圖檔」用 overlay 疊到生成好的圖上,固定左上角。
// pixel-perfect、每張位置固定,不靠 AI 畫 logo(AI 畫會走樣)。
// 同時支援 1.91:1 的裁切(cropAr)。純函式,client / server 都可用。

function b64(s) {
  // 只在瀏覽器端用(overlay 由 client 呼叫);避免在 client bundle 引用 Node 的 Buffer
  try {
    if (typeof btoa === 'function') return btoa(unescape(encodeURIComponent(s)));
  } catch (_) {}
  return '';
}

// 從 Cloudinary logo URL 取出 overlay layer 名(public_id,'/' 換 ':','去副檔名')
function cloudinaryLayerFromUrl(logoUrl) {
  const m = logoUrl.match(/res\.cloudinary\.com\/[^/]+\/image\/upload\/(?:[^/]+\/)*?(?:v\d+\/)?(.+)$/);
  if (!m) return null;
  let pid = m[1].replace(/\?.*$/, '').replace(/\.[a-zA-Z0-9]+$/, '');
  // 去掉可能殘留的 transform 前綴(保守:只取 version 之後)
  const vIdx = logoUrl.indexOf('/upload/');
  if (vIdx >= 0) {
    const after = logoUrl.slice(vIdx + '/upload/'.length).replace(/^([^/]*_[^/]*\/)*/, '');
    pid = after.replace(/^v\d+\//, '').replace(/\?.*$/, '').replace(/\.[a-zA-Z0-9]+$/, '');
  }
  return 'l_' + pid.replace(/\//g, ':');
}

/**
 * 回傳「已套裁切 + 疊 logo」的 Cloudinary URL。
 * @param {string} imageUrl - 生成好的 Cloudinary 圖 URL
 * @param {object} opts
 * @param {string} [opts.cropAr] - 例 '191:100'(1.91:1 用),null 則不裁切
 * @param {string} [opts.logoUrl] - 真 logo 圖 URL(建議同帳號 Cloudinary)
 * @param {number} [opts.widthPct=0.16] - logo 佔圖寬比例
 * @param {number} [opts.x=36] [opts.y=36] - 左上角邊距(px)
 * @param {number} [opts.opacity=100]
 */
export function decorateImageUrl(imageUrl, opts = {}) {
  if (!imageUrl || !/res\.cloudinary\.com\/.+\/image\/upload\//.test(imageUrl)) return imageUrl;
  const { cropAr = null, logoUrl = '', widthPct = 0.16, x = 36, y = 36, opacity = 100 } = opts;
  const comps = [];

  // 1) 裁切(base)
  if (cropAr) comps.push(`c_fill,g_auto,ar_${cropAr},w_1080`);

  // 2) 疊 logo(左上角)
  const logo = (logoUrl || '').trim();
  if (logo) {
    let layer = null;
    if (/res\.cloudinary\.com\//.test(logo)) {
      layer = cloudinaryLayerFromUrl(logo);
    } else {
      // 外部 URL → fetch overlay
      layer = 'l_fetch:' + b64(logo);
    }
    if (layer) {
      const o = opacity < 100 ? `,o_${opacity}` : '';
      comps.push(`${layer},w_${widthPct},fl_relative,g_north_west,x_${x},y_${y}${o}`);
    }
  }

  if (comps.length === 0) return imageUrl;
  return imageUrl.replace('/image/upload/', `/image/upload/${comps.join('/')}/`);
}
