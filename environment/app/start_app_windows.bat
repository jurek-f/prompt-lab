@echo off
cd /d "%~dp0..\..\app"
start "API Server" cmd /k "npm run dev:api"
timeout /t 2 /nobreak > nul
npm run dev
