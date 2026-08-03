@echo off
title HoneyPot proxy (keep this window OPEN)
cd /d "%~dp0"

set "PYCMD="

where py >nul 2>nul
if %errorlevel%==0 set "PYCMD=py -3"

if not defined PYCMD (
  where python >nul 2>nul
  if %errorlevel%==0 set "PYCMD=python"
)

if not defined PYCMD (
  echo [ERROR] Python 3 was not found.
  echo.
  echo Fix: go to https://www.python.org/downloads/
  echo      install Python, and CHECK "Add python.exe to PATH".
  echo.
  pause
  exit /b 1
)

echo ============================================
echo  HoneyPot proxy is starting...
echo  1) Opening index.html in your browser...
start "" "index.html"

echo  2) Proxy is running now.
echo     KEEP THIS WINDOW OPEN. Closing it disconnects.
echo     (You can minimize it.)
echo.
%PYCMD% -X utf8 proxy.py

echo.
echo Proxy stopped.
pause
