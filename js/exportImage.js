const JPEG_QUALITY = 0.92;
const EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png' };

// rect（元画像のピクセル座標）の範囲を元の解像度のまま切り出す。
export async function cropToBlob(image, rect, type) {
  const canvas = document.createElement('canvas');
  canvas.width = rect.w;
  canvas.height = rect.h;
  const ctx = canvas.getContext('2d');
  if (type === 'image/jpeg') {
    // JPEG は透過を持てないので、透過部分は白にする
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, rect.w, rect.h);
  }
  ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, JPEG_QUALITY));
  if (!blob) throw new Error('canvas.toBlob returned null');
  return blob;
}

export function buildFileName(originalName, rect, type) {
  const base = originalName.replace(/\.[^.]+$/, '') || 'image';
  return `${base}_crop_${rect.w}x${rect.h}.${EXTENSIONS[type]}`;
}

function isIOS() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// iPhone / iPad は共有シート（「画像を保存」で写真アプリへ）、それ以外はダウンロード。
// 共有シートをユーザーが閉じた場合は false を返す。
export async function saveBlob(blob, name) {
  if (isIOS() && navigator.canShare) {
    const file = new File([blob], name, { type: blob.type });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return true;
      } catch (err) {
        if (err.name === 'AbortError') return false;
        console.warn('share failed, falling back to download', err);
      }
    }
  }
  download(blob, name);
  return true;
}
