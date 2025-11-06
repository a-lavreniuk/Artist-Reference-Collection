@echo off
echo ========================================
echo Переименование старой PWA версии
echo ========================================
echo.
echo Закрываю возможные процессы...
timeout /t 2 /nobreak >nul
echo.

cd C:\GitHub\arc

if exist arc-app (
    echo Переименовываю arc-app в arc-app-OLD-PWA-backup...
    ren arc-app arc-app-OLD-PWA-backup
    
    if exist arc-app-OLD-PWA-backup (
        echo.
        echo ✅ Успешно переименовано!
        echo.
        echo Старая PWA версия теперь: arc-app-OLD-PWA-backup
        echo Новая Electron версия:    arc-electron
        echo.
    ) else (
        echo.
        echo ❌ Ошибка переименования
        echo Возможно файлы используются другим процессом.
        echo Закройте все редакторы и терминалы в этой папке.
        echo.
    )
) else (
    echo.
    echo ⚠️  Папка arc-app не найдена
    echo Возможно уже переименована?
    echo.
    if exist arc-app-OLD-PWA-backup (
        echo ✅ Найдена arc-app-OLD-PWA-backup - переименование уже выполнено!
    )
    echo.
)

echo Текущие папки:
dir /B /AD

echo.
echo Нажмите любую клавишу для выхода...
pause >nul

