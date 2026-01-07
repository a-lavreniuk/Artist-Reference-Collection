/**
 * Утилита для генерации placeholder изображений
 * Используется когда невозможно создать превью из исходного файла
 */

import sharp from 'sharp';

/**
 * Создать placeholder изображение для неподдерживаемого формата
 * @param format - Расширение файла
 * @param width - Ширина изображения
 * @param height - Высота изображения
 * @returns Buffer с PNG изображением
 */
export async function createPlaceholderImage(
  format: string,
  width: number = 512,
  height: number = 512
): Promise<Buffer> {
  // Создаем серое изображение с текстом формата
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="#e0e0e0"/>
      <text
        x="50%"
        y="45%"
        font-family="Arial, sans-serif"
        font-size="48"
        font-weight="bold"
        fill="#666666"
        text-anchor="middle"
        dominant-baseline="middle"
      >${format.toUpperCase()}</text>
      <text
        x="50%"
        y="55%"
        font-family="Arial, sans-serif"
        font-size="16"
        fill="#999999"
        text-anchor="middle"
        dominant-baseline="middle"
      >Превью недоступно</text>
    </svg>
  `;

  // Конвертируем SVG в PNG
  const buffer = await sharp(Buffer.from(svg))
    .png()
    .toBuffer();

  return buffer;
}

/**
 * Создать набор placeholder превью (blur, compact, standard)
 * @param format - Расширение файла
 * @returns Объект с тремя Buffer'ами
 */
export async function createPlaceholderSet(format: string): Promise<{
  blur: Buffer;
  compact: Buffer;
  standard: Buffer;
}> {
  // Создаем базовое изображение
  const baseImage = await createPlaceholderImage(format, 512, 512);

  // Blur превью (20px с размытием)
  const blur = await sharp(baseImage)
    .resize(20, 20, { fit: 'inside' })
    .blur(10)
    .webp({ quality: 50 })
    .toBuffer();

  // Compact превью (256px)
  const compact = await sharp(baseImage)
    .resize(256, 256, { fit: 'inside' })
    .webp({ quality: 85 })
    .toBuffer();

  // Standard превью (512px)
  const standard = await sharp(baseImage)
    .webp({ quality: 85 })
    .toBuffer();

  return { blur, compact, standard };
}



