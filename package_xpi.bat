@echo off
setlocal
echo ===================================================
echo     SafeSearch - Firefox .xpi Packager
echo ===================================================
echo.

where node >nul 2>nul
if %ERRORLEVEL% equ 0 (
    node package_xpi.js
    goto done
)

echo [INFO] Node.js not detected in PATH. Using native Windows archiving...
powershell -Command "Compress-Archive -Path dist\firefox\* -DestinationPath safesearch-firefox.zip -Force"
if exist "safesearch-firefox.xpi" del /f /q "safesearch-firefox.xpi"
ren safesearch-firefox.zip safesearch-firefox.xpi
copy /y safesearch-firefox.xpi dist\safesearch-firefox.xpi >nul

:done
echo.
echo ===================================================
echo [SUCCESS] Package ready: safesearch-firefox.xpi
echo ===================================================
echo.
pause
