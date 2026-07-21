# Petición de acceso de red: 10.0.0.21 → ERP (10.0.0.19:8000)

> Documento para enviar al responsable de sistemas. Diagnóstico del 2026-07-21.

## Qué se pide

Permitir el acceso del equipo **10.0.0.21** (`vmwin11.favram.local`) al servicio
**10.0.0.19:8000/TCP** (API del ERP).

No se pide ningún cambio en el ERP ni en sus datos. Solo conectividad de red.

## Síntoma

Desde **10.0.0.21**, cualquier llamada a la API del ERP agota el tiempo de espera:

```
[vite] http proxy error: /fichajes/getMotivosAusencias
Error: connect ETIMEDOUT 10.0.0.19:8000
```

Esto afecta **ya hoy** a la aplicación de presencia que corre en ese equipo:
lleva sin poder cargar datos del ERP.

## Diagnóstico realizado

| Comprobación | Resultado |
|---|---|
| ERP activo | ✅ Responde correctamente |
| `10.0.0.80` → `10.0.0.19:8000` | ✅ **Funciona** (226 ms, HTTP 200) |
| `10.0.0.21` → `10.0.0.19:8000` | ❌ **ETIMEDOUT** |
| Ping `10.0.0.80` → `10.0.0.19` | ✅ 2 ms |
| Ping `10.0.0.80` → `10.0.0.21` | ✅ 1 ms |
| Subred | Los tres equipos en `10.0.0.0/24`, mismo segmento |

Los tres equipos están en la misma subred y se ven por ICMP, así que **no es un
problema de rutas ni de gateway**. El error es `ETIMEDOUT` (paquetes descartados)
y no `ECONNREFUSED` (servicio caído), lo que apunta a un **filtrado de paquetes**.

**Hipótesis:** el puerto 8000 de `10.0.0.19` tiene una lista blanca de IPs.
`10.0.0.80` fue autorizado en su momento para las pruebas de la API; `10.0.0.21`
nunca lo estuvo.

## Dónde mirar

1. Firewall de Windows en `10.0.0.19`: regla de entrada del puerto 8000 y su
   ámbito de IPs remotas permitidas.
2. Configuración del servicio de la API (si filtra por IP a nivel de aplicación).
3. Si `10.0.0.21` es una VM: modo de red del adaptador virtual. En NAT, su
   tráfico podría salir con una IP distinta a la esperada.

## Para verificar que queda resuelto

Ejecutar **en 10.0.0.21**:

```powershell
Invoke-WebRequest -Uri "http://10.0.0.19:8000/fichajes/getControlOfProduccion?n_orden=OF26-05315" -UseBasicParsing
```

Debe devolver `StatusCode: 200`. Actualmente da timeout.

## Por qué hace falta

El equipo `10.0.0.21` va a alojar un servicio que permite que los operarios
escriban el número de OF en los kioskos del almacén y el código de artículo se
rellene automáticamente desde el ERP.

Ese servicio es de **solo lectura**: únicamente hace peticiones `GET` al endpoint
`/fichajes/getControlOfProduccion`. No escribe, no modifica y no borra nada en el
ERP, y no invoca ninguno de los endpoints de escritura de la API
(`insertarFichaje`, `updateFichaje`, `updateCalendaOperario`).

Tampoco extrae datos personales: la respuesta del ERP incluye identificadores y
nombres de operarios, y el servicio los **descarta** — solo conserva número de OF,
código de artículo, cantidad a fabricar y estado.
