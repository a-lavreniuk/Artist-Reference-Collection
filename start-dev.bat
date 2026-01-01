@echo off
echo Starting ARC Electron Development...
echo.
echo Starting Vite dev server...
cd renderer
start /B cmd /C "npm run dev"
timeout /t 5 /nobreak >nul
cd ..
echo Starting Electron...
set NODE_ENV=development
npm run electron:dev

