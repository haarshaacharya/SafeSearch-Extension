@echo off
cd /d "%~dp0"
echo ===================================================
echo     SafeSearch - Firefox Android Deployment
echo ===================================================
echo.
echo Please ensure:
echo  1. Your phone is connected via USB cable
echo  2. USB Debugging is turned ON in Developer Options
echo  3. Firefox Nightly has "Remote debugging via USB" enabled
echo.
echo Starting web-ext...
echo.

npx web-ext run --target=firefox-android --source-dir="dist\firefox"

echo.
pause
