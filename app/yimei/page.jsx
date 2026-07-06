'use client';

// 醫美素材AI生成 — 醫美專用獨立頁 (industry 鎖定 medical_aesthetics)
// 共用 /material 的素材產生流程,只是預設就是醫美、不顯示產業切換。
import MaterialPage from '../material/page.jsx';

export default function YimeiPage() {
  return <MaterialPage lockIndustry="medical_aesthetics" />;
}
