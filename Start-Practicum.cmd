@echo off
cd /d "%~dp0"
call npm.cmd run build
if errorlevel 1 (
  pause
  exit /b 1
)
call npm.cmd exec -- electron .
if errorlevel 1 pause
