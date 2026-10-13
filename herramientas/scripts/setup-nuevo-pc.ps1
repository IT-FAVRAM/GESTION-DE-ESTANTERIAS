# Prepara un PC nuevo para trabajar con GESTION-DE-ESTANTERIAS.
# Uso: doble clic en setup-nuevo-pc.bat  (o .\setup-nuevo-pc.ps1 -Destino C:\WMS)
# Requisitos: Git y Node.js (LTS) instalados.
param([string]$Destino = 'C:\WMS')

$ErrorActionPreference = 'Stop'
try {
  foreach ($cmd in 'git', 'node', 'npm') {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { throw "Falta '$cmd'. Instalalo y vuelve a ejecutar." }
  }

  if (Test-Path $Destino) { throw "$Destino ya existe. Elige otro destino o borralo." }
  Write-Host "Clonando en $Destino ..."
  git clone https://github.com/IT-FAVRAM/GESTION-DE-ESTANTERIAS $Destino
  if ($LASTEXITCODE -ne 0) { throw 'git clone fallo (revisa conexion / acceso al repo).' }

  foreach ($d in 'aplicacion', 'servidor') {
    Write-Host "npm install en $d ..."
    Push-Location (Join-Path $Destino $d)
    npm install
    if ($d -eq 'servidor') {
      Write-Host "Compilando el servidor (npm run build) ..."
      npm run build
    }
    Pop-Location
  }

  if (-not (Get-Command firebase -ErrorAction SilentlyContinue)) { npm install -g firebase-tools }

  Write-Host ''
  Write-Host 'LISTO. Falta copiar a mano (USB, NUNCA por git ni correo):'
  Write-Host "  $Destino\serviceAccount.json"
  Write-Host "  $Destino\servidor\.env.keys.json"
  Write-Host "  $Destino\aplicacion\.env.local"
  Write-Host "  $Destino\bridge\.env   (solo si este PC ejecuta el bridge ERP)"
  Write-Host 'Despues ejecuta:  firebase login'
}
catch {
  Write-Host ''
  Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
}
