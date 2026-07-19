# Setup Script - Run this after create-next-app completes
# This copies all source files into mm-chart-app and installs remaining dependencies

$src = "G:\My Drive\Antigravity\Man-Mahcine Chart(Standard Operation)"
$dest = "$src\mm-chart-app"

# 1. Copy src/ tree
Write-Host "Copying source files..." -ForegroundColor Cyan
Copy-Item -Path "$src\src\*" -Destination "$dest\src\" -Recurse -Force

# 2. Copy config files
Write-Host "Copying config files..." -ForegroundColor Cyan
Copy-Item -Path "$src\next.config.ts"    -Destination "$dest\next.config.ts" -Force
Copy-Item -Path "$src\tailwind.config.ts" -Destination "$dest\tailwind.config.ts" -Force
Copy-Item -Path "$src\tsconfig.json"     -Destination "$dest\tsconfig.json" -Force

# 3. Install extra packages
Write-Host "Installing extra packages..." -ForegroundColor Cyan
Set-Location $dest
& "C:\Program Files\nodejs\npm.cmd" install zustand uuid html2canvas jspdf @types/uuid 2>&1

Write-Host "Done! Run: npm run dev" -ForegroundColor Green
