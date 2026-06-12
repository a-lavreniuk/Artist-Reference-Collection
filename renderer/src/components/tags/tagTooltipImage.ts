export const TAG_TOOLTIP_IMAGE_MAX_W = 368;
export const TAG_TOOLTIP_IMAGE_MAX_H = 207;
export const TAG_TOOLTIP_IMAGE_ASPECT = TAG_TOOLTIP_IMAGE_MAX_W / TAG_TOOLTIP_IMAGE_MAX_H;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => {
      if (typeof fr.result === 'string') resolve(fr.result);
      else reject(new Error('Не удалось прочитать файл'));
    };
    fr.onerror = () => reject(new Error('Не удалось прочитать файл'));
    fr.readAsDataURL(file);
  });
}

/** Уменьшает изображение, если оно больше 368×207, сохраняя пропорции. */
export function resizeTagTooltipImageDataUrl(dataUrl: string, mimeType = 'image/png'): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(
        1,
        TAG_TOOLTIP_IMAGE_MAX_W / img.naturalWidth,
        TAG_TOOLTIP_IMAGE_MAX_H / img.naturalHeight
      );
      if (scale >= 1) {
        resolve(dataUrl);
        return;
      }
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      try {
        resolve(canvas.toDataURL(mimeType));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => reject(new Error('Не удалось обработать изображение'));
    img.src = dataUrl;
  });
}

export async function processTagTooltipImageFile(file: File): Promise<string> {
  const dataUrl = await readFileAsDataUrl(file);
  const mimeType = file.type === 'image/jpeg' || file.type === 'image/webp' ? file.type : 'image/png';
  return resizeTagTooltipImageDataUrl(dataUrl, mimeType);
}
