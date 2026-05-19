# Mini PC Startup Batch File

Save this as your startup `.bat` file on the mini PC.

```bat
@echo off
echo Starting Colin's services...
echo.

echo [1/6] Starting Cloudflare tunnel...
start "Cloudflare Tunnel" cmd /k "cloudflared tunnel run --protocol auto portfolio"

timeout /t 3 /nobreak >nul
echo.

echo [2/6] Starting AI Backend on port 2514...
start "AI Backend" cmd /k "cd /d C:\Users\User\Desktop\colin-tts && call .venv\Scripts\activate && python -m uvicorn backend.main:app --host 0.0.0.0 --port 2514 --proxy-headers --forwarded-allow-ips \"*\""
echo.

echo [3/6] Starting FileShare server...
start "Filebrowser" "C:\Users\User\Desktop\colin-tts\start-filebrowser.bat"
echo.

echo [4/6] Starting SUGE Exam Tutor on port 8002...
start "SUGE Exam" cmd /k "cd /d C:\Users\User\Desktop\SUGE-tester && python -m uvicorn suge_tutor.main:app --host 0.0.0.0 --port 8002"
echo.

echo [5/6] Starting WSL services (Hermes, Dashboard, Bots)...
start "WSL Services" "C:\Users\User\Desktop\colin-tts\start-wsl-services.bat"
echo.

echo [6/6] Starting R6 Tracker scraper worker...
start "R6 Tracker Scraper Worker" cmd /k "cd /d C:\Users\User\Desktop\scraper-lab && npm run worker"
echo.

echo All services starting in separate windows.
echo.
pause
```
