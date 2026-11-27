@echo off
title Garimpo (deixe esta janela aberta)
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 if exist "%USERPROFILE%\tools\node-v26.13.1-win-x64\node.exe" set "PATH=%USERPROFILE%\tools\node-v26.13.1-win-x64;%PATH%"
node server.mjs --open
pause
