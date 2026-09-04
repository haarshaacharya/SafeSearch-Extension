@echo off
setlocal
echo ===================================================
echo     SafeSearch - GitHub Upload Helper Script
echo ===================================================
echo.

REM Check if git is installed
where git >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Git is not found in your PATH!
    echo Please install Git from https://git-scm.com/ and try again.
    echo.
    pause
    exit /b 1
)

echo Initializing git repository...
if not exist ".git" (
    git init
)

echo Adding files...
git add .

echo Committing files...
git commit -m "Initial commit: SafeSearch Chrome Extension v1.3"

echo Setting default branch to main...
git branch -M main

echo.
set /p REPO_URL="Enter your GitHub Repository URL (e.g., https://github.com/username/safesearch.git): "

if "%REPO_URL%"=="" (
    echo.
    echo [NOTE] No URL provided. Git commits are ready locally.
    echo When you are ready, run:
    echo   git remote add origin YOUR_REPOSITORY_URL
    echo   git push -u origin main
    echo.
    pause
    exit /b 0
)

echo Adding remote origin...
git remote remove origin >nul 2>nul
git remote add origin %REPO_URL%

echo Pushing to GitHub...
git push -u origin main

echo.
if %ERRORLEVEL% equ 0 (
    echo ===================================================
    echo [SUCCESS] Your repository has been uploaded to GitHub!
    echo ===================================================
) else (
    echo.
    echo [NOTE] If authentication is needed, please log in with GitHub credentials or personal access token.
)

echo.
pause
