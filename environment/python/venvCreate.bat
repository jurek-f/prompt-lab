@echo off
cd /d "%~dp0..\.."
python -m venv .venv
call .venv\Scripts\activate.bat
pip install -r environment\python\requirements.txt
echo.
echo venv ready. To activate: .venv\Scripts\activate.bat
