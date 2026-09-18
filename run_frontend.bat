@echo off
title AgriBund AI - GIS Frontend
set PATH=C:\Users\nisha\AppData\Local\Programs\node;%PATH%
cd /d "%~dp0frontend"
echo Starting AgriBund GIS Web Workstation on http://localhost:5173 ...
npm run dev
pause
