/**
 * Утилита для рендеринга PDF файлов в изображения
 * Использует pdf.js для извлечения первой страницы
 * 
 * ВАЖНО: Для работы в Node.js требуется canvas пакет
 * Однако для упрощения интеграции используем подход через ghostscript/imagemagick
 * или просто создаем placeholder для PDF файлов
 */

import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Создать placeholder для PDF файла
 * Вместо рендеринга PDF создаем простое изображение с иконкой PDF
 * @param pdfPath - Путь к PDF файлу
 * @returns null - для упрощения пока возвращаем null, 
 *          что означает что превью будет создан из placeholder
 */
export async function renderPdfToImage(pdfPath: string, maxWidth: number = 1024): Promise<Buffer | null> {
  try {
    console.log('[PDFRenderer] PDF файл обнаружен:', pdfPath);
    console.log('[PDFRenderer] Для PDF используется placeholder (рендеринг требует дополнительных зависимостей)');
    
    // Проверяем что файл существует
    await fs.access(pdfPath);
    
    // Возвращаем null - будет использован placeholder
    return null;
  } catch (error) {
    console.error('[PDFRenderer] Ошибка доступа к PDF:', error);
    throw new Error(`Не удалось получить доступ к PDF: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Проверить является ли файл валидным PDF
 * Простая проверка по magic bytes (PDF начинается с %PDF)
 * @param pdfPath - Путь к PDF файлу
 * @returns true если файл начинается с PDF signature
 */
export async function isValidPdf(pdfPath: string): Promise<boolean> {
  try {
    // Читаем первые 5 байт файла
    const fd = await fs.open(pdfPath, 'r');
    const buffer = Buffer.alloc(5);
    await fd.read(buffer, 0, 5, 0);
    await fd.close();
    
    // PDF файлы начинаются с %PDF-
    const signature = buffer.toString('utf-8', 0, 5);
    return signature === '%PDF-';
  } catch (error) {
    console.warn('[PDFRenderer] Ошибка проверки PDF:', error);
    return false;
  }
}

