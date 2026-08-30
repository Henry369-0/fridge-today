// 客户端图片压缩：最长边压到 1024px、JPEG q0.8（约 100-300KB）——省流量、省 token、上传快。
// 尺寸计算是纯函数（可单测），解码画布部分只能在浏览器里跑。

export const MAX_SIDE = 1024;
export const JPEG_QUALITY = 0.8;

export function computeTargetSize(
  w: number,
  h: number,
  maxSide: number = MAX_SIDE,
): { width: number; height: number } {
  if (w <= maxSide && h <= maxSide) {
    return { width: Math.max(1, Math.round(w)), height: Math.max(1, Math.round(h)) };
  }
  const scale = maxSide / Math.max(w, h);
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
  };
}

async function loadBitmap(file: File): Promise<{
  el: CanvasImageSource;
  w: number;
  h: number;
  release: () => void;
}> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file);
      return { el: bmp, w: bmp.width, h: bmp.height, release: () => bmp.close() };
    } catch {
      // 老浏览器兜底走 <img>
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("图片解码失败"));
      img.src = url;
    });
    return { el: img, w: img.naturalWidth, h: img.naturalHeight, release: () => URL.revokeObjectURL(url) };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

export async function compressImageFile(file: File, maxSide: number = MAX_SIDE): Promise<string> {
  const { el, w, h, release } = await loadBitmap(file);
  try {
    const { width, height } = computeTargetSize(w, h, maxSide);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas 不可用");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(el, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  } finally {
    release();
  }
}
