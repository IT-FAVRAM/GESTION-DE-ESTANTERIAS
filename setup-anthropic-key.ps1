#!/usr/bin/env pwsh
# setup-anthropic-key.ps1 - Configura la API key de Claude para contador de chapas

Write-Host "🔐 CONFIGURACIÓN DE API KEY DE CLAUDE PARA CONTADOR DE CHAPAS" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# PASO 1: Validar que Firebase CLI está instalado
Write-Host "1️⃣  Verificando Firebase CLI..." -ForegroundColor Yellow
$firebaseCheck = firebase --version 2>$null
if ($null -eq $firebaseCheck) {
    Write-Host "❌ Firebase CLI no está instalado." -ForegroundColor Red
    Write-Host "   Instálalo: npm install -g firebase-tools" -ForegroundColor Yellow
    exit 1
}
Write-Host "✅ Firebase CLI encontrado: $firebaseCheck" -ForegroundColor Green
Write-Host ""

# PASO 2: Validar autenticación Firebase
Write-Host "2️⃣  Verificando autenticación Firebase..." -ForegroundColor Yellow
$authCheck = firebase auth:export /dev/null 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  No estás autenticado en Firebase." -ForegroundColor Yellow
    Write-Host "   Ejecutando: firebase login" -ForegroundColor Cyan
    firebase login
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Autenticación fallida." -ForegroundColor Red
        exit 1
    }
}
Write-Host "✅ Autenticado en Firebase" -ForegroundColor Green
Write-Host ""

# PASO 3: Pedir la API key
Write-Host "3️⃣  Ingresa tu API KEY de Claude" -ForegroundColor Yellow
Write-Host "   (Asegúrate de haber revocado la anterior en console.anthropic.com)" -ForegroundColor Cyan
Write-Host ""

$apiKey = Read-Host "   Pega tu NUEVA API key de Claude"

if ([string]::IsNullOrWhiteSpace($apiKey)) {
    Write-Host "❌ API key vacía. Abortando." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ API key capturada" -ForegroundColor Green
Write-Host ""

# PASO 4: Establecer el secret en Firebase
Write-Host "4️⃣  Estableciendo secret en Firebase..." -ForegroundColor Yellow
$confirmApiKey = $apiKey | firebase functions:secrets:set ANTHROPIC_API_KEY 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Secret establecido en Firebase" -ForegroundColor Green
} else {
    Write-Host "❌ Error al establecer secret:" -ForegroundColor Red
    Write-Host $confirmApiKey
    exit 1
}
Write-Host ""

# PASO 5: Deploy de Cloud Functions
Write-Host "5️⃣  Deployando Cloud Functions..." -ForegroundColor Yellow
Write-Host "   (Esto puede tomar 2-5 minutos)" -ForegroundColor Cyan
Write-Host ""

$deployResult = firebase deploy --only functions 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Deploy completado exitosamente" -ForegroundColor Green
    Write-Host ""
    Write-Host "🎉 LISTO - Contador de chapas configurado" -ForegroundColor Green
    Write-Host ""
    Write-Host "Próximos pasos:" -ForegroundColor Cyan
    Write-Host "  1. Abre la app: https://gestion-de-estanterias.web.app" -ForegroundColor White
    Write-Host "  2. Ve a sección PUNZONADO" -ForegroundColor White
    Write-Host "  3. Sube una foto de chapas para probar" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "❌ Error en el deploy:" -ForegroundColor Red
    Write-Host $deployResult
    exit 1
}
