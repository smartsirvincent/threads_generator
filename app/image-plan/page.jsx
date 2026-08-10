// 圖片貼文流程已整合進「廣告圖片生成」(/material)。舊連結自動導向。
import { redirect } from 'next/navigation';

export default function ImagePlanRedirect() {
  redirect('/material');
}
