@echo off
REM Double-click launcher for the Claude Mission Control monitor window.
REM Opens a read-only dashboard in your browser that live-updates as Claude
REM works. Keep this window open while you want the monitor running; close
REM it (or press Ctrl+C) to stop.
setlocal
cd /d "%~dp0"

if not exist "node_modules\" (
  echo First-time setup: installing dependencies. This runs only once...
  call npm install
  if errorlevel 1 ( echo. & echo Setup failed. See the messages above. & pause & exit /b 1 )
)

if not exist "packages\ui\dist\dashboard.html" (
  echo Building the monitor dashboard. This runs only once...
  call npm run build:dashboard
  if errorlevel 1 ( echo. & echo Build failed. See the messages above. & pause & exit /b 1 )
)

echo.
echo Starting the Mission Control monitor.
echo Your browser will open at http://127.0.0.1:8642/?monitor
echo.
call npm run monitor
if errorlevel 1 ( echo. & echo The monitor stopped with an error. See the messages above. & pause )
