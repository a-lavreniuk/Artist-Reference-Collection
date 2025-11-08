/**
 * Скрипт для генерации icon.ico из SVG
 * Создаёт PNG разных размеров и объединяет их в .ico файл
 */

const sharp = require('sharp');
const toIco = require('to-ico');
const fs = require('fs').promises;
const path = require('path');

// Размеры для .ico файла
const SIZES = [16, 32, 48, 64, 128, 256];

async function generateIcon() {
  console.log('🎨 Генерация иконки приложения...');
  
  const svgPath = path.join(__dirname, '../resources/app-icon.svg');
  const outputDir = path.join(__dirname, '../resources/temp_icons');
  const iconPath = path.join(__dirname, '../resources/icon.ico');
  
  try {
    // 1. Читаем SVG
    const svgBuffer = await fs.readFile(svgPath);
    console.log('✅ SVG файл загружен');
    
    // 2. Создаём временную папку для PNG
    await fs.mkdir(outputDir, { recursive: true });
    console.log('✅ Временная папка создана');
    
    // 3. Генерируем PNG для каждого размера
    const pngBuffers = [];
    
    for (const size of SIZES) {
      const pngBuffer = await sharp(svgBuffer)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 } // Белый фон для лучшей видимости
        })
        .png()
        .toBuffer();
      
      pngBuffers.push(pngBuffer);
      console.log(`✅ PNG ${size}x${size} создан`);
    }
    
    // 4. Объединяем PNG буферы в .ico файл
    console.log('🔄 Создание .ico файла...');
    const icoBuffer = await toIco(pngBuffers);
    await fs.writeFile(iconPath, icoBuffer);
    console.log('✅ icon.ico создан:', iconPath);
    
    // 5. Удаляем временную папку (она больше не нужна)
    try {
      await fs.rm(outputDir, { recursive: true, force: true });
      console.log('✅ Временная папка удалена');
    } catch (error) {
      console.log('⚠️ Не удалось удалить временную папку:', error.message);
    }
    
    console.log('');
    console.log('🎉 Иконка успешно создана!');
    console.log('📁 Путь:', iconPath);
    console.log('📦 Размеры:', SIZES.join('x') + 'px');
    
  } catch (error) {
    console.error('❌ Ошибка генерации иконки:', error);
    process.exit(1);
  }
}

// Запускаем генерацию
generateIcon();

