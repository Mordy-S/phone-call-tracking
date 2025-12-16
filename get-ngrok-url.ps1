# Get ngrok URL for Telebroad webhook
Write-Host "`n🌐 Getting ngrok URL...`n" -ForegroundColor Cyan

Start-Sleep -Seconds 2

try {
    $response = Invoke-RestMethod -Uri "http://localhost:4040/api/tunnels"
    $url = $response.tunnels | Where-Object { $_.proto -eq "https" } | Select-Object -First 1 -ExpandProperty public_url
    
    if ($url) {
        Write-Host "✅ Your ngrok URL is:" -ForegroundColor Green
        Write-Host ""
        Write-Host "   $url" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "📋 Use this URL in Telebroad webhook:" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "   $url/webhooks/telebroad" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "🌐 ngrok Dashboard: http://localhost:4040" -ForegroundColor Gray
        Write-Host ""
        
        # Copy to clipboard
        "$url/webhooks/telebroad" | Set-Clipboard
        Write-Host "✅ URL copied to clipboard!" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Ngrok is starting... Please wait and run this script again." -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  Cannot connect to ngrok. Make sure ngrok is running!" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To start ngrok, run: ngrok http 3000" -ForegroundColor Gray
}

Write-Host ""
