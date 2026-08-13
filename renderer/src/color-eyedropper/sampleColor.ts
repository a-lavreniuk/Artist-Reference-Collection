export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

export function clientToImagePixel(
  clientX: number,
  clientY: number,
  viewWidth: number,
  viewHeight: number,
  imageWidth: number,
  imageHeight: number
): { x: number; y: number } {
  const vw = Math.max(1, viewWidth);
  const vh = Math.max(1, viewHeight);
  const x = Math.max(0, Math.min(imageWidth - 1, Math.round((clientX / vw) * imageWidth)));
  const y = Math.max(0, Math.min(imageHeight - 1, Math.round((clientY / vh) * imageHeight)));
  return { x, y };
}

export function hexFromImageData(data: Uint8ClampedArray, pixelIndex: number): string | null {
  const offset = pixelIndex * 4;
  if (offset + 2 >= data.length) return null;
  return rgbToHex(data[offset], data[offset + 1], data[offset + 2]);
}
