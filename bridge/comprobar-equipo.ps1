# Comprobación previa del equipo que alojará el ERP Bridge.
#
# Ejecútalo EN EL PC DESTINO (10.0.0.21) antes de instalar nada:
#
#   powershell -ExecutionPolicy Bypass -File comprobar-equipo.ps1
#
# No modifica nada: solo mira y avisa.

$ErrorActionPreference = 'Continue'
$problemas = @()

function Resultado($ok, $etiqueta, $detalle) {
    $marca = if ($ok) { '[ OK ]' } else { '[FALLO]' }
    Write-Host ("{0}  {1,-34} {2}" -f $marca, $etiqueta, $detalle)
}

Write-Host ""
Write-Host "=== Comprobacion del equipo para el ERP Bridge ===" -ForegroundColor Cyan
Write-Host ""

# 1. Identidad del equipo
$ips = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' }).IPAddress -join ', '
Resultado $true "Equipo" "$env:COMPUTERNAME  ($ips)"

# 2. Node.js
$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) {
    $version = (& node --version)
    $major = [int](($version -replace '^v', '') -split '\.')[0]
    $ok = $major -ge 18
    Resultado $ok "Node.js" "$version (se necesita v18 o superior)"
    if (-not $ok) { $problemas += "Node.js es demasiado antiguo. Instala la version LTS desde https://nodejs.org" }
} else {
    Resultado $false "Node.js" "NO instalado"
    $problemas += "Instala Node.js LTS desde https://nodejs.org (marca 'Add to PATH')"
}

# 3. Acceso al ERP — la razon de ser de este equipo
try {
    $r = Invoke-WebRequest -Uri "http://10.0.0.19:8000/fichajes/getControlOfProduccion?n_orden=OF26-05315" `
                           -TimeoutSec 15 -UseBasicParsing
    $filas = ($r.Content | ConvertFrom-Json).Count
    Resultado $true "Acceso al ERP (10.0.0.19:8000)" "responde, $filas filas para OF26-05315"
} catch {
    Resultado $false "Acceso al ERP (10.0.0.19:8000)" $_.Exception.Message
    $problemas += "Este equipo NO ve el ERP. Sin esto el bridge no sirve: revisa red/firewall."
}

# 4. Salida a internet (Firestore)
try {
    $null = Invoke-WebRequest -Uri "https://firestore.googleapis.com" -TimeoutSec 15 -UseBasicParsing
    Resultado $true "Salida a Google/Firestore" "accesible"
} catch {
    # Un 4xx tambien significa que hay conectividad: el host respondio.
    if ($_.Exception.Response) {
        Resultado $true "Salida a Google/Firestore" "accesible"
    } else {
        Resultado $false "Salida a Google/Firestore" $_.Exception.Message
        $problemas += "Sin salida HTTPS a Google. El bridge no podra hablar con Firestore."
    }
}

# 5. Permisos de administrador (necesarios para instalar el servicio)
$esAdmin = ([Security.Principal.WindowsPrincipal] `
            [Security.Principal.WindowsIdentity]::GetCurrent()
           ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
Resultado $esAdmin "Consola como administrador" $(if ($esAdmin) { "si" } else { "no (hace falta solo para instalar el servicio)" })

# 6. Plan de energia — que no se suspenda
$plan = (powercfg /getactivescheme) -replace '.*\(([^)]+)\).*', '$1'
Resultado $true "Plan de energia" $plan

Write-Host ""
if ($problemas.Count -eq 0) {
    Write-Host "Todo listo. Puedes continuar con la instalacion." -ForegroundColor Green
} else {
    Write-Host "Hay que resolver esto antes de instalar:" -ForegroundColor Yellow
    $problemas | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }
}
Write-Host ""
