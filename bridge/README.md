# ERP Bridge

Puente entre Firestore (nube) y la API del ERP (`http://10.0.0.19:8000`, solo LAN).

Permite que el operario **escriba la OF y el artículo se rellene solo**, en kioskos,
tablets y móviles — incluso fuera de la red de la nave.

## Por qué existe

El ERP vive en una IP privada. Nadie desde fuera de la LAN puede llamarlo:

| Intento | Por qué falla |
|---|---|
| Cloud Function → ERP | Las Functions están en la nube, no ven `10.0.0.19` |
| Navegador → ERP | La app es HTTPS y el ERP HTTP → **Mixed Content** |
| Proxy en `localhost:3000` (intento previo) | Habría que instalarlo en **cada** tablet y kiosko |

El bridge le da la vuelta al problema: corre en **un** PC de la nave y solo hace
conexiones **salientes**. No abre ningún puerto al exterior.

```
App ──escribe {status:'pending'}──> erp_lookups/{OF} <──resultado── Bridge ──> ERP
 └───────────── escucha el mismo documento (onSnapshot) ─────────────┘
```

Firestore hace además de **caché**: una OF ya consultada se resuelve al instante,
sin tocar el ERP.

## Instalación (una sola vez, en el PC fijo)

### 1. Requisitos
- Node.js 18 o superior.
- Que el PC vea el ERP. Compruébalo:
  ```powershell
  curl "http://10.0.0.19:8000/fichajes/getControlOfProduccion?n_orden=OF26-05315"
  ```

### 2. Service account dedicada

En la [consola de Firebase](https://console.firebase.google.com) →
**Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada**.

Guarda el JSON **fuera del repositorio**, por ejemplo `C:\erp-bridge\bridge-service-account.json`.

> ⚠️ Esa clave da acceso de escritura al proyecto. No la subas a git, no la
> copies a las tablets y no la compartas por WhatsApp. Vive solo en este PC.

### 3. Configurar

```powershell
cd bridge
npm install
copy .env.example .env
notepad .env    # ajusta GOOGLE_APPLICATION_CREDENTIALS
```

### 4. Probar a mano

```powershell
npm start
```

Deberías ver:

```
[bridge] ERP Bridge iniciando
[bridge] ERP: http://10.0.0.19:8000/fichajes/getControlOfProduccion
[bridge] Conexión con el ERP verificada ✓
[bridge] Escuchando erp_lookups con status='pending'…
```

Ahora, desde la app, escribe una OF en cualquier pantalla de ubicar. En la consola
del bridge debería aparecer algo como:

```
[bridge] OF26-05315: Q674837400Q81 — 10 filas (243 ms)
```

### 5. Probar el circuito sin la app

Con el bridge corriendo, en otra ventana:

```powershell
node -r dotenv/config test-lookup.js OF26-05315
```

```
→ Pidiendo OF26-05315…
← Resuelto en 819 ms con status="done"
  Filas del ERP: 10
  • Q674837400Q81  (a fabricar: 150)  [estado 3]
```

Es la forma más rápida de saber si el problema está en el bridge o en la app.

### 6. Instalarlo como servicio

Con una consola **como administrador**:

```powershell
cd bridge
npm run install-service
```

A partir de aquí arranca solo al encender el PC y se reinicia si se cae.

- Gestión: `services.msc` → **ERP Bridge WMS**
- Logs: `bridge\daemon\*.log`
- Desinstalar: `npm run uninstall-service`

## Diagnóstico

**En la app sale "Sin conexión con el ERP"**

1. ¿Está el servicio corriendo? → `services.msc`
2. ¿Ve el PC al ERP? → el `curl` del paso 1
3. ¿Está vivo el bridge? → en Firestore, `erp_bridge/status` tiene `lastSeen`
   actualizándose cada minuto. Si está congelado, el bridge está caído.
4. Mira `bridge\daemon\*.log`

**Una OF concreta no encuentra artículo**

Mira el documento `erp_lookups/{OF}` en Firestore:

| `status` | Significa |
|---|---|
| `done` + `articles` | Todo bien |
| `not_found` | El ERP no tiene esa OF (¿existe? ¿el año es correcto?) |
| `error` | El campo `error` dice qué pasó |
| `pending` atascado | El bridge está caído — se resolverá solo al levantarlo |

**Formato de la OF**

El ERP es estricto: exige `OFyy-nnnnn` con 5 dígitos. `OF26-5315` devuelve
**cero filas**; `OF26-05315` funciona. La app ya normaliza esto automáticamente
(`APP/frontend/lib/erp/ofNormalize.ts`), incluido el relleno de ceros y el año.
Si tocas esa lógica, mantén el bridge en sintonía.
