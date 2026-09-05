@echo off
setlocal
echo ===================================================
echo     SafeSearch - Multi-Browser Extension Builder
echo ===================================================
echo.

where node >nul 2>nul
if %ERRORLEVEL% equ 0 (
    node build.js
    goto done
)

echo [INFO] Node.js not detected in PATH. Using native Windows file copy...
echo.

if not exist "dist\chrome" mkdir "dist\chrome"
if not exist "dist\firefox" mkdir "dist\firefox"

echo Copying to dist\chrome...
xcopy /E /I /Y "src" "dist\chrome" >nul
copy /Y "manifests\manifest.chrome.json" "dist\chrome\manifest.json" >nul

echo Copying to dist\firefox...
xcopy /E /I /Y "src" "dist\firefox" >nul
copy /Y "manifests\manifest.firefox.json" "dist\firefox\manifest.json" >nul

echo.
echo ===================================================
echo [SUCCESS] Extensions built successfully!
echo   - Chrome / Edge:   dist\chrome\
echo   - Firefox / Mobile: dist\firefox\
echo ===================================================

:done
echo.
pause
