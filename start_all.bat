@echo off
title AgriBund AI - One-Click Launcher
echo ========================================================
echo   Starting AgriBund AI (PS06 Boundary Detection Engine)
echo ========================================================

start "" "%~dp0run_backend.bat"
timeout /t 3 /nobreak >nul
start "" "%~dp0run_frontend.bat"
timeout /t 3 /nobreak >nul

echo Opening browser at http://localhost:5173 ...
start http://localhost:5173
