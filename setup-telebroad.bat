@echo off
REM Telebroad Auto-Setup for Windows
REM This will automatically set up your Telebroad webhook integration

echo.
echo ========================================
echo   TELEBROAD AUTO-SETUP
echo ========================================
echo.

cd /d "%~dp0"

echo Checking Node.js installation...
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed!
    echo Please install from: https://nodejs.org
    pause
    exit /b 1
)

echo.
echo Starting automated Telebroad setup...
echo.

node scripts\setup-telebroad.js

pause
