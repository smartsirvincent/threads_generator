// 醫美素材 已併入「廣告圖片生成」(/material)。舊連結自動導向。
import { redirect } from 'next/navigation';

export default function YimeiRedirect() {
  redirect('/material');
}
