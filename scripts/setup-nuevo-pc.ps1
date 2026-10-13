# Prepara un PC nuevo para trabajar con GESTOR-ESTANTERIAS.
# Uso (PowerShell):  .\setup-nuevo-pc.ps1 [-Destino C:\WMS]
# Requisitos: Git y Node.js (LTS) instalados.
param([string]$Destino = 'C:\WMS')

$ErrorActionPreference = 'Stop'
foreach ($cmd in 'git', 'node', 'npm') {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { throw "Falta '$cmd'. Instálalo y vuelve a ejecutar." }
}

if (Test-Path $Destino) { throw "$Destino ya existe. Elige otro destino o bórralo." }
git clone https://github.com/Daniel123456139/GESTOR-ESTANTERIAS $Destino

foreach ($d in 'APP\frontend', 'APP\backend') {
  Write-Host "npm install en $d ..."
  Push-Location (Join-Path $Destino $d); npm install; Pop-Location
}

if (-not (Get-Command firebase -ErrorAction SilentlyContinue)) { npm install -g firebase-tools }

Write-Host @"

LISTO. Falta copiar a mano (USB / carpeta cifrada, NUNCA por git ni correo):
  $Destino\serviceAccount.json
  $Destino\APP\.env.keys.json
  $Destino\APP\frontend\.env.local
  $Destino\bridge\.env            (solo si este PC ejecuta el bridge ERP)
Después:  firebase login
"@
