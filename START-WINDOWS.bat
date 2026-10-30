@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ===============================================
echo   Sookhtresan - Online Organization Edition
echo ===============================================
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js نصب نيست. نسخه 22 يا بالاتر را از nodejs.org نصب کنيد.
  pause
  exit /b 1
)
node -e "const v=process.versions.node.split('.').map(Number); if(v[0]<22){console.error('Node.js 22 يا بالاتر لازم است.'); process.exit(1)}"
if errorlevel 1 (pause & exit /b 1)
if not exist node_modules (
  echo در حال نصب وابستگي‌ها...
  call npm install
  if errorlevel 1 (echo نصب وابستگي‌ها ناموفق بود.& pause & exit /b 1)
)
echo در حال اجراي آزمون‌هاي اوليه...
call npm run test:smoke
if errorlevel 1 (echo آزمون‌ها ناموفق بود؛ اجرا متوقف شد.& pause & exit /b 1)
call npm run dev
pause
