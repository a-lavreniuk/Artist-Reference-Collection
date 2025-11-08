# Шрифты для ARC

## 📁 Используемые шрифты

### YS Music
**Файл:** `YSMusic-HeadlineBold.ttf`  
**Использование:** Заголовки (h1, h2, h3, h4)  
**Вес:** 700 (Bold)

### Geologica
**Файлы:**
- `Geologica-Light.ttf` — 300 (основной текст)
- `Geologica-Regular.ttf` — 400 (кнопки, инпуты)
- `Geologica-Bold.ttf` — 700 (акценты, выделение)

**Использование:** Основной текст приложения

---

## 📦 Архив дополнительных начертаний

**Файл:** `geologica-extra-fonts-archive.tar.gz`

Содержит 24 дополнительных начертания Geologica:
- **Auto варианты** (9 файлов): Thin, ExtraLight, Light, Regular, Medium, SemiBold, Bold, ExtraBold, Black
- **Cursive варианты** (9 файлов): Thin, ExtraLight, Light, Regular, Medium, SemiBold, Bold, ExtraBold, Black
- **Базовые варианты** (6 файлов): Thin, ExtraLight, Medium, SemiBold, ExtraBold, Black

### Как извлечь архив (если понадобятся дополнительные начертания)

```bash
# В терминале PowerShell
cd C:\GitHub\arc\renderer\public\fonts
tar -xzf geologica-extra-fonts-archive.tar.gz
```

ИЛИ просто распакуйте через WinRAR / 7-Zip.

---

## 🎨 Подключение в приложении

Шрифты подключаются в `src/styles/typography.css`:

```css
/* YS Music для заголовков */
@font-face {
  font-family: 'YS Music';
  src: url('/fonts/YSMusic-HeadlineBold.ttf') format('truetype');
  font-weight: 700;
}

/* Geologica для текста */
@font-face {
  font-family: 'Geologica';
  src: url('/fonts/Geologica-Light.ttf') format('truetype');
  font-weight: 300;
}

@font-face {
  font-family: 'Geologica';
  src: url('/fonts/Geologica-Regular.ttf') format('truetype');
  font-weight: 400;
}

@font-face {
  font-family: 'Geologica';
  src: url('/fonts/Geologica-Bold.ttf') format('truetype');
  font-weight: 700;
}
```

---

## 📊 Размер файлов

**Текущие (активные):**
- `YSMusic-HeadlineBold.ttf` — ~150 KB
- `Geologica-Light.ttf` — ~70 KB
- `Geologica-Regular.ttf` — ~70 KB
- `Geologica-Bold.ttf` — ~70 KB

**Итого:** ~360 KB (оптимизировано)

**Архив:**
- `geologica-extra-fonts-archive.tar.gz` — ~1.5 MB (сжато)

---

## 💡 Примечания

1. **Оптимизация:** Оставлены только необходимые начертания для уменьшения размера приложения
2. **Fallback:** В CSS переменных добавлены системные шрифты как fallback
3. **Загрузка:** Используется `font-display: swap` для быстрой загрузки
4. **Архив:** Дополнительные начертания сохранены на будущее в архиве

---

## 🔗 Источники

- **YS Music:** [Яндекс.Музыка Type Family](https://www.paratype.ru/fonts/pt/yandex-music)
- **Geologica:** [Google Fonts](https://fonts.google.com/specimen/Geologica)

---

**Последнее обновление:** 08.11.2025  
**Версия:** 1.0
