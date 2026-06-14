'use client';

import { useState } from 'react';

/**
 * 自動 fallback:優先載 /logo.png (用戶提供),載入失敗才 fallback 到 /logo.svg (預設)
 */
export default function Logo({ className = 'h-8 w-auto', alt = 'FUN AI' }) {
  const [src, setSrc] = useState('/logo.png');
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setSrc('/logo.svg')}
    />
  );
}
