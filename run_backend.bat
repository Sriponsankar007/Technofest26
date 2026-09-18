@echo off
title AgriBund AI - Backend Engine
cd /d "%~dp0backend"
call .\venv\Scripts\activate.bat
echo Starting AgriBund AI Backend on http://127.0.0.1:8000 ...
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
pause
