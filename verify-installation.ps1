# Script para verificar instalação do Liturgia IASD

Write-Host "=== Verificando Instalação do Liturgia IASD ===" -ForegroundColor Cyan
Write-Host ""

# 1. Verificar pasta de instalação
Write-Host "1. Pasta de instalação:" -ForegroundColor Yellow
$installPath = "$env:LOCALAPPDATA\liturgia-iasd"
if (Test-Path $installPath) {
    Write-Host "   ✅ ENCONTRADA: $installPath" -ForegroundColor Green
    $folders = Get-ChildItem $installPath -Directory
    foreach ($folder in $folders) {
        Write-Host "      - $($folder.Name)" -ForegroundColor Gray
    }
} else {
    Write-Host "   ❌ NÃO ENCONTRADA" -ForegroundColor Red
}
Write-Host ""

# 2. Verificar atalho no Menu Iniciar
Write-Host "2. Atalho no Menu Iniciar:" -ForegroundColor Yellow
$startMenuPath = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs"
$shortcuts = Get-ChildItem $startMenuPath -Filter "*Liturgia*.lnk" -Recurse -ErrorAction SilentlyContinue
if ($shortcuts) {
    foreach ($shortcut in $shortcuts) {
        Write-Host "   ✅ ENCONTRADO: $($shortcut.FullName)" -ForegroundColor Green
    }
} else {
    Write-Host "   ❌ NÃO ENCONTRADO" -ForegroundColor Red
}
Write-Host ""

# 3. Verificar atalho na Área de Trabalho
Write-Host "3. Atalho na Área de Trabalho:" -ForegroundColor Yellow
$desktopPath = "$env:USERPROFILE\Desktop"
$desktopShortcuts = Get-ChildItem $desktopPath -Filter "*Liturgia*.lnk" -ErrorAction SilentlyContinue
if ($desktopShortcuts) {
    foreach ($shortcut in $desktopShortcuts) {
        Write-Host "   ✅ ENCONTRADO: $($shortcut.FullName)" -ForegroundColor Green
    }
} else {
    Write-Host "   ❌ NÃO ENCONTRADO" -ForegroundColor Red
}
Write-Host ""

# 4. Verificar registro no Windows (Adicionar/Remover Programas)
Write-Host "4. Registro em Adicionar/Remover Programas:" -ForegroundColor Yellow
$uninstallKeys = @(
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKLM:\Software\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*"
)

$found = $false
foreach ($key in $uninstallKeys) {
    $apps = Get-ItemProperty $key -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like "*Liturgia*" }
    if ($apps) {
        foreach ($app in $apps) {
            Write-Host "   ✅ ENCONTRADO: $($app.DisplayName)" -ForegroundColor Green
            Write-Host "      Versão: $($app.DisplayVersion)" -ForegroundColor Gray
            Write-Host "      Editor: $($app.Publisher)" -ForegroundColor Gray
            Write-Host "      Desinstalador: $($app.UninstallString)" -ForegroundColor Gray
            $found = $true
        }
    }
}
if (-not $found) {
    Write-Host "   ❌ NÃO ENCONTRADO" -ForegroundColor Red
}
Write-Host ""

# 5. Verificar executável
Write-Host "5. Executável principal:" -ForegroundColor Yellow
$exePath = "$env:LOCALAPPDATA\liturgia-iasd\liturgia-iasd.exe"
if (Test-Path $exePath) {
    Write-Host "   ✅ ENCONTRADO: $exePath" -ForegroundColor Green
} else {
    Write-Host "   ❌ NÃO ENCONTRADO" -ForegroundColor Red
}
Write-Host ""

Write-Host "=== Verificação Concluída ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Pressione qualquer tecla para sair..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
