# Threads 社群貼文產生器

輸入產品特色 → AI 推薦 5–8 個客製化主題 → 整月內容批次生成 → 含 AI 圖 → 輸出 xlsx

兩種使用方式：
1. **Web UI**（Next.js + Tailwind，可部署 Vercel）
2. **CLI**（`node generate.js input.json`）

---

## 8 種 universal post type

| Key | 用途 | 範例（既有檔案）|
|---|---|---|
| `product_with_image` | 產品介紹（含 AI 圖） | 87 餐點、Infuz 單件、NX250 新風 |
| `product_with_url` | 產品介紹（帶網址） | NX250(帶網址)、Infuz 圖文排程 |
| `opinion_short` | 觀點短文 | 新風短文、穿衣哲學 |
| `brand_quote` | 品牌人格語錄 | 霸氣語錄、霸氣87 |
| `tutorial` | 教學小知識 | 身形診斷、身型小教室 |
| `quiz` | 心理測驗 | 87 心理測驗 |
| `engagement` | 高互動引戰 | 87/Infuz/瑞際 高互動 |
| `persona_narrative` | 情境角色文 | 氣象穿搭、讀空氣 |

## 環境變數（`.env`）

```bash
# 必要：文案生成
ANTHROPIC_API_KEY=sk-ant-...

# 選用：AI 圖片生成（含圖主題用）
KIE_API_KEY=...
CLOUDINARY_CLOUD_NAME=your_cloud
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
# 或用 unsigned preset:
# CLOUDINARY_UPLOAD_PRESET=preset_name
```

`KIE_API_KEY` 來自 [kie.ai](https://kie.ai)，`CLOUDINARY_*` 來自 [cloudinary.com](https://cloudinary.com)。沒設 KIE/Cloudinary 也能跑（只跳過 AI 圖階段）。

---

## 本機跑

```powershell
cd threads-generator
npm install
copy .env.example .env
# 編輯 .env 填入金鑰

# Web UI
npm run dev
# 開 http://localhost:3000

# CLI
node generate.js examples/input-87grill.json --dry-run   # 不打 API,只驗 schema
node generate.js examples/input-87grill.json             # 真實生成
```

---

## 部署 Vercel

1. 在 GitHub 建 repo，把 `threads-generator/` 推上去
2. Vercel → New Project → Import 該 repo
3. Environment Variables 加入：
   - `ANTHROPIC_API_KEY`
   - `KIE_API_KEY`
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
4. Deploy

**Function timeout 限制**：
| Vercel Plan | maxDuration | 適用情境 |
|---|---|---|
| Hobby（免費）| 60s | 只能跑 dry-run / 推薦主題 |
| Pro | 300s | 中型品牌（~50 篇）含圖 OK |
| Pro Fluid Compute | 800s | 完整 200 篇含圖 OK |

`vercel.json` 已設 800s。Hobby 帳號會被 cap 到 60s，但不會壞，只是大型 job 會 timeout。

---

## input.json 結構（CLI 用）

```json
{
  "brand": "品牌名",
  "product": "主打產品",
  "product_features": "詳細產品特色（可貼官網介紹）",
  "audience": "受眾畫像",
  "brand_persona": "品牌人格與口吻",
  "purchase_url": "https://...",
  "product_images": ["https://...", "..."],
  "platforms": ["Threads", "IG", "FB"],
  "monthly_total": 150,
  "start_date": "2026-06-08",
  "generate_images": true
}
```

## 輸出 Excel 結構

```
output/<brand>.xlsx
├── 發文規劃 (master)          ← 主題索引 + 排程 + 品牌設定
├── <主題 1>                   ← AI 推薦的客製化主題名
├── ...
└── 產品資訊                    ← 產品特色 + 圖 URL + 購買連結
```

含圖主題的 `AI圖` 欄位會自動填入 Cloudinary 永久 URL。

---

## 架構

```
threads-generator/
├── app/                       ← Next.js Web UI
│   ├── layout.jsx
│   ├── page.jsx
│   └── api/
│       ├── recommend/route.js
│       ├── generate/route.js  (SSE 串流)
│       └── download/[id]/route.js
├── components/
│   ├── Step1Form.jsx
│   ├── Step2Themes.jsx
│   ├── Step3Progress.jsx
│   └── Step4Done.jsx
├── lib/
│   ├── llm.js                 ← Claude API wrapper (JSON mode)
│   ├── recommend.js           ← AI 推薦主題
│   ├── generate-posts.js      ← 各主題批次生成
│   ├── excel-writer.js        ← xlsx 輸出 (Buffer / File)
│   ├── schedule.js            ← 「每日下午4點」解析器
│   ├── schemas.js             ← 8 種 universal type
│   ├── kie-image.js           ← KIE GPT Image 2 wrapper
│   └── cloudinary.js          ← Cloudinary 上傳 (image / raw)
├── generate.js                ← CLI 入口
├── scripts/test-image-flow.js ← KIE → Cloudinary smoke test
├── examples/
│   ├── input-87grill.json
│   ├── input-infuz.json
│   └── input-ruiji.json
├── vercel.json
└── .env.example
```

---

## 成本估算

| 項目 | 單位 | 100 篇 | 200 篇 |
|---|---|---|---|
| Claude Sonnet 4.5 文案 | ~$0.005/篇 | ~$0.5 | ~$1 |
| KIE GPT Image 2（含圖主題約 1/6）| ~$0.04/張 | ~$0.6 | ~$1.3 |
| Cloudinary | 免費 25GB | $0 | $0 |
| **總計** | | **~$1.1** | **~$2.3** |
