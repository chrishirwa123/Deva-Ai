@echo off
setlocal

echo ===============================================
echo   Deva AI - Starting up
echo ===============================================

REM Move to the folder this script lives in
cd /d "%~dp0"

REM Create a virtual environment if one doesn't exist yet
if not exist ".venv\Scripts\activate.bat" (
    echo Creating virtual environment...
    python -m venv .venv
)

call .venv\Scripts\activate.bat

echo Installing/checking dependencies...
pip install -r requirements.txt --quiet

if not exist ".env" (
    echo Creating .env from .env.example...
    copy .env.example .env >nul
)

echo.
echo Checking Ollama is reachable at http://127.0.0.1:11434 ...
curl -s http://127.0.0.1:11434/api/tags >nul 2>&1
if errorlevel 1 (
    echo.
    echo WARNING: Could not reach Ollama at http://127.0.0.1:11434
    echo Start it first with:  ollama serve
    echo And make sure the model is pulled:  ollama pull qwen3:1.7b
    echo.
)

echo.
echo Launching Deva AI at http://127.0.0.1:5000
echo Press CTRL+C to stop.
echo.

python app.py

endlocal
