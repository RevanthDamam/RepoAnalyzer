Write-Host "Starting RepoAnalyzer..." -ForegroundColor Cyan

# Start FastAPI Backend in background
Write-Host "Launching FastAPI Backend..." -ForegroundColor Green
Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", "cd backend; ..\venv\Scripts\activate; uvicorn app.main:app --reload --port 8000"

# Start Vite Frontend in background
Write-Host "Launching Vite Frontend..." -ForegroundColor Green
Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev"

Write-Host "Both services launched!" -ForegroundColor Cyan
Write-Host "Backend API: http://127.0.0.1:8000/api" -ForegroundColor Yellow
Write-Host "Frontend App: http://localhost:5173" -ForegroundColor Yellow
