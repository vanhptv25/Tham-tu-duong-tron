@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo === THAM TU DUONG TRON: KHOI DONG PHONG HOC ===
where py >nul 2>nul
if %errorlevel% equ 0 (
  set "PY=py"
) else (
  where python >nul 2>nul
  if %errorlevel% equ 0 (
    set "PY=python"
  ) else (
    echo Chua tim thay Python. Vui long cai Python 3.10+.
    pause
    exit /b 1
  )
)
%PY% -m pip install -r requirements.txt
if errorlevel 1 (
  echo Khong cai duoc thu vien. Vui long kiem tra Internet.
  pause
  exit /b 1
)
echo.
echo Mo trinh duyet: http://localhost:8080
echo Giu cua so nay mo khi hoc sinh dang choi.
start "" "http://localhost:8080"
%PY% server.py
pause
