@echo off
REM ========================================
REM Lev Lehazin Helpline - Automation Runner
REM Run from CMD: automations.bat [command]
REM ========================================

cd /d "%~dp0"

if "%1"=="" goto help
if "%1"=="help" goto help
if "%1"=="--help" goto help
if "%1"=="-h" goto help

if "%1"=="all" goto all
if "%1"=="followups" goto followups
if "%1"=="digest" goto digest
if "%1"=="overdue" goto overdue
if "%1"=="status" goto status
if "%1"=="urgent" goto urgent
if "%1"=="scheduler" goto scheduler
if "%1"=="test" goto test

echo Unknown command: %1
goto help

:help
echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║     LEV LEHAZIN HELPLINE - AUTOMATION COMMANDS               ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.
echo USAGE:
echo   automations.bat [command]
echo.
echo COMMANDS:
echo   all        - Run all automations
echo   followups  - Create follow-ups from calls needing callback
echo   digest     - Generate daily digest report
echo   overdue    - Check for overdue follow-ups
echo   status     - Show system status
echo   urgent     - Check for urgent/crisis calls
echo   scheduler  - Start background scheduler (runs continuously)
echo   test       - Test Airtable connection
echo   help       - Show this help message
echo.
echo EXAMPLES:
echo   automations.bat all         (Morning routine - run everything)
echo   automations.bat digest      (Get daily summary)
echo   automations.bat scheduler   (Start background service)
echo.
goto end

:all
echo Running all automations...
node scripts/run-automations.js --all
goto end

:followups
echo Checking for calls needing follow-up...
node scripts/run-automations.js --followups
goto end

:digest
echo Generating daily digest...
node scripts/run-automations.js --digest
goto end

:overdue
echo Checking for overdue follow-ups...
node scripts/run-automations.js --overdue
goto end

:status
echo Getting system status...
node scripts/run-automations.js --status
goto end

:urgent
echo Checking for urgent calls...
node scripts/run-automations.js --urgent
goto end

:scheduler
echo Starting background scheduler (Press Ctrl+C to stop)...
node scripts/scheduler.js
goto end

:test
echo Testing Airtable connection...
node scripts/test-connection.js
goto end

:end
