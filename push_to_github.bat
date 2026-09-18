@echo off
title Push AgriBund to GitHub
cd /d "%~dp0"
set "GIT_EXE=C:\Users\nisha\AppData\Local\GitHubDesktop\app-3.6.6\resources\app\git\cmd\git.exe"
if not exist "%GIT_EXE%" set "GIT_EXE=git"

echo ========================================================
echo   Pushing branch 'AgriBund' to:
echo   https://github.com/Sriponsankar007/Technofest26.git
echo ========================================================
echo.

"%GIT_EXE%" push -u origin AgriBund

if %ERRORLEVEL% EQU 0 (
    echo.
    echo [SUCCESS] Successfully pushed to branch AgriBund!
) else (
    echo.
    echo [NOTICE] If prompted for credentials, sign in with GitHub or your Personal Access Token.
)
pause
