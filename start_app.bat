@echo off
title Launch Verify System
echo ===================================================
echo   LAUNCHING VERIFY: PLAGIARISM & AI SHIELD SYSTEM
echo ===================================================
echo.

:: 1. Launch FastAPI backend in a new console window
echo [1/3] Launching FastAPI Backend on Port 8000...
start "Verify API Backend" cmd /c "cd backend && python -m uvicorn app:app --host 127.0.0.1 --port 8000 --reload"

:: 2. Launch Vite React frontend in a new console window
echo [2/3] Launching Vite React Frontend...
start "Verify Frontend Client" cmd /c "cd frontend && npm run dev"

:: 3. Wait 3 seconds for servers to initialize, then launch the browser webpage
echo [3/3] Launching browser window...
timeout /t 3 /nobreak >nul
start http://localhost:5173

echo.
echo ===================================================
echo   System running. Close the terminal windows to stop.
echo ===================================================
timeout /t 5 >nul
