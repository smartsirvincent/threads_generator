// 文字貼文流程已整合進「內容發文」(/post)。舊連結自動導向。
import { redirect } from 'next/navigation';

export default function TextRedirect() {
  redirect('/post');
}
