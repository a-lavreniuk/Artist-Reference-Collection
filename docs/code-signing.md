# Настройка цифровой подписи кода (Code Signing)

Цифровая подпись кода необходима для устранения предупреждений Windows SmartScreen при установке приложения. Без подписи пользователи увидят предупреждение "Неопознанный издатель".

## Зачем нужна цифровая подпись?

- **Доверие пользователей**: Windows не показывает предупреждения при установке
- **Безопасность**: подтверждает, что приложение не было изменено после публикации
- **Репутация**: помогает быстрее набрать репутацию в Windows SmartScreen
- **Профессионализм**: выглядит более надежно для пользователей

## Получение сертификата

### Вариант 1: Платные сертификаты (рекомендуется)

Приобретите сертификат Code Signing у одного из авторизованных поставщиков:

- **DigiCert** (от $400/год) - https://www.digicert.com/
- **Sectigo** (от $200/год) - https://sectigo.com/
- **GlobalSign** (от $250/год) - https://www.globalsign.com/
- **Certum** (от €80/год) - https://www.certum.eu/ (дешевле для индивидуальных разработчиков)

**Процесс получения:**
1. Выберите поставщика и тип сертификата (Organization или Individual)
2. Заполните форму заявки с вашими данными
3. Пройдите процедуру верификации (может занять несколько дней)
4. Получите файл сертификата (.pfx или .p12) и пароль

### Вариант 2: Самоподписанный сертификат (только для тестирования)

**⚠️ ВАЖНО**: Самоподписанные сертификаты **НЕ** устраняют предупреждения Windows. Используйте только для локального тестирования.

```bash
# Создание самоподписанного сертификата (PowerShell)
$cert = New-SelfSignedCertificate -Type CodeSigningCert `
  -Subject "CN=Your Name, O=Your Organization, C=RU" `
  -KeyUsage DigitalSignature `
  -FriendlyName "ARC Code Signing" `
  -CertStoreLocation "Cert:\CurrentUser\My" `
  -NotAfter (Get-Date).AddYears(2)

# Экспорт в PFX файл
$password = ConvertTo-SecureString -String "YourPassword" -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath "C:\path\to\certificate.pfx" -Password $password
```

## Настройка для локальной сборки

### Шаг 1: Сохраните сертификат

Разместите файл сертификата в безопасном месте:
- **Рекомендуется**: вне репозитория (например, `C:\Certificates\arc-cert.pfx`)
- **НЕ КОММИТЬТЕ** сертификат в git!
- Добавьте `*.pfx` и `*.p12` в `.gitignore`

### Шаг 2: Установите переменные окружения

**Windows (PowerShell):**

```powershell
# Временно (для текущей сессии)
$env:CSC_LINK = "C:\Certificates\arc-cert.pfx"
$env:CSC_KEY_PASSWORD = "ваш_пароль"

# Постоянно (через системные переменные)
[System.Environment]::SetEnvironmentVariable('CSC_LINK', 'C:\Certificates\arc-cert.pfx', 'User')
[System.Environment]::SetEnvironmentVariable('CSC_KEY_PASSWORD', 'ваш_пароль', 'User')
```

**Windows (CMD):**

```cmd
set CSC_LINK=C:\Certificates\arc-cert.pfx
set CSC_KEY_PASSWORD=ваш_пароль
```

### Шаг 3: Соберите приложение с подписью

```bash
# Сборка с подписью
npm run build:prod:signed

# Результат: release/ARC-Setup-1.0.0.exe (подписанный)
```

## Настройка для GitHub Actions

### Шаг 1: Конвертируйте сертификат в Base64

**PowerShell:**

```powershell
$fileContent = [System.IO.File]::ReadAllBytes("C:\Certificates\arc-cert.pfx")
$base64String = [System.Convert]::ToBase64String($fileContent)
$base64String | Set-Clipboard
# Или сохраните в файл
$base64String | Out-File -Encoding ASCII certificate-base64.txt
```

**Linux/macOS:**

```bash
base64 -i certificate.pfx -o certificate-base64.txt
```

### Шаг 2: Добавьте Secrets в GitHub

1. Откройте репозиторий на GitHub
2. Перейдите в **Settings** → **Secrets and variables** → **Actions**
3. Нажмите **New repository secret**
4. Добавьте следующие secrets:

| Название | Значение |
|----------|----------|
| `WINDOWS_CERTIFICATE` | Содержимое certificate-base64.txt (Base64 строка) |
| `WINDOWS_CERTIFICATE_PASSWORD` | Пароль от сертификата |

**⚠️ После добавления удалите файл certificate-base64.txt с диска!**

### Шаг 3: Проверьте workflow

Workflow `.github/workflows/build.yml` уже настроен для использования этих secrets.

При создании тега (например, `v1.0.0`) и push в GitHub:
1. GitHub Actions автоматически декодирует сертификат
2. Соберет приложение с подписью
3. Опубликует релиз с подписанным установщиком

## Проверка подписи

### После сборки проверьте подпись:

**Windows (PowerShell):**

```powershell
Get-AuthenticodeSignature "release\ARC-Setup-1.0.0.exe"
```

**Ожидаемый результат:**
- `Status`: Valid
- `SignerCertificate`: информация о сертификате
- `TimeStamperCertificate`: временная метка

### В Windows Explorer:

1. Правой кнопкой на `ARC-Setup-1.0.0.exe`
2. Выберите **Свойства**
3. Перейдите на вкладку **Цифровые подписи**
4. Должна отображаться ваша подпись

## Сборка без подписи

Если у вас нет сертификата, приложение всё равно соберется, но:
- Windows покажет предупреждение "Неопознанный издатель" при установке
- Пользователям нужно будет нажать "Дополнительно" → "Выполнить в любом случае"

Для сборки без подписи:

```bash
npm run build:prod
```

## Безопасность

### Важные правила:

1. **НЕ коммитьте** файлы сертификатов (.pfx, .p12) в git
2. **НЕ публикуйте** пароли от сертификатов
3. **НЕ используйте** тот же сертификат на нескольких машинах без необходимости
4. **Храните резервную копию** сертификата в безопасном месте
5. **Используйте GitHub Secrets** для CI/CD, не храните в коде

### Добавьте в .gitignore:

```gitignore
# Сертификаты
*.pfx
*.p12
certificate*.txt
*.cer
*.pem
```

## Часто задаваемые вопросы

### Сколько стоит сертификат?

От €80 до $400 в год, в зависимости от поставщика и типа (Individual/Organization).

### Как долго действует сертификат?

Обычно 1-3 года. После истечения нужно продлевать.

### Нужен ли сертификат для каждой версии?

Нет, один сертификат используется для всех версий приложения в течение срока действия.

### Что будет, если сертификат истечет?

Старые релизы останутся подписанными, но новые сборки нужно подписывать новым сертификатом.

### Можно ли обойтись без сертификата?

Да, но пользователи увидят предупреждения Windows. Для коммерческого или публичного распространения сертификат настоятельно рекомендуется.

## Полезные ссылки

- [Microsoft: Introduction to Code Signing](https://docs.microsoft.com/en-us/windows-hardware/drivers/install/introduction-to-code-signing)
- [electron-builder: Code Signing](https://www.electron.build/code-signing)
- [Certum Code Signing](https://www.certum.eu/en/code-signing-certificates/)
- [SSL.com: What is Code Signing?](https://www.ssl.com/article/what-is-code-signing/)


