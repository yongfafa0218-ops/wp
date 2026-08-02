@echo off
chcp 65001 >nul
title HoneyPot 프롬프트 브릿지
cd /d "%~dp0"

echo ============================================
echo   HoneyPot 프록시 시작 (종료: 이 창 닫기)
echo ============================================
echo.
echo 1) index.html을 브라우저에서 엽니다...
start "" "index.html"

echo 2) 프록시를 시작합니다. 창은 계속 열어두세요.
echo.
python proxy.py

echo.
echo 프록시가 종료되었습니다.
pause
