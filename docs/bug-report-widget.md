# Виджет баг-репортов

Плавающая кнопка в ARC открывает **внешнюю форму** (Яндекс.Формы, Google Forms и т.д.) в браузере.

## Настройка

1. Создайте форму на [forms.yandex.ru](https://forms.yandex.ru) (или другом сервисе).
2. Скопируйте ссылку на форму.
3. Создайте файл:

   `%APPDATA%\artist-reference-collection\bug-report.json`

   Содержимое:

   ```json
   {
     "formUrl": "https://forms.yandex.ru/u/6a382e851f1eb55aed4c9c42"
   }
   ```

   В бета-сборках эта же ссылка уже подставлена по умолчанию; файл нужен только чтобы переопределить URL.

   Пример: [`config/bug-report.example.json`](../config/bug-report.example.json).

4. Перезапустите ARC.

## Альтернатива: переменная окружения

```powershell
$env:ARC_BUG_REPORT_URL = "https://forms.yandex.ru/u/xxxxxxxx/"
```

## Где виджет

- Плавающая кнопка в правом нижнем углу приложения.
- Меню навбара → «Сообщить о проблеме».
- Горячая клавиша **Ctrl+Shift+B**.

Ответы собираются в кабинете выбранного сервиса форм.
