# 🔧 Configuración del Proxy Local CORS

## ¿Por qué un Proxy Local?

Firebase Cloud Functions tiene limitaciones con CORS cuando hace solicitudes a direcciones HTTP internas (10.0.0.19:8000). El navegador bloquea estas solicitudes con error de CORS.

**Solución:** Un servidor Express local que:
1. Corre en tu red LAN (HTTP)
2. Actúa como intermediario (proxy)
3. Hace solicitudes a 10.0.0.19:8000 sin problemas
4. Devuelve datos con CORS habilitado

## 📋 Pasos de Instalación

### 1️⃣ Instalar dependencias

```bash
# En la carpeta raíz del proyecto
npm install express cors node-fetch
```

O solo en backend:
```bash
cd APP/backend
npm install cors
```

### 2️⃣ Ejecutar el Proxy Server

```bash
# Desde la carpeta raíz
node proxy-server.js
```

**Salida esperada:**
```
╔════════════════════════════════════════════════════════════╗
║  CORS PROXY SERVER ACTIVO                                  ║
╠════════════════════════════════════════════════════════════╣
║                                                            ║
║  🌐 http://localhost:3000                                  ║
║  🔗 http://192.168.X.X:3000 (desde otras máquinas)         ║
║                                                            ║
║  📝 Endpoint: /api/articulo?orderFab=OF26-XXXXX            ║
║  ❤️  Health:  /health                                      ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
```

### 3️⃣ Configurar Variable de Entorno (Opcional)

**Si la app está en la MISMA máquina:**
```
# APP/frontend/.env.local (crear si no existe)
REACT_APP_PROXY_URL=http://localhost:3000
```

**Si la app está en OTRA máquina:**
```
# Averiguar IP de la máquina con el proxy
# Windows: ipconfig → buscar "IPv4 Address"
# Linux/Mac: ifconfig o hostname -I

# Entonces en la otra máquina:
REACT_APP_PROXY_URL=http://192.168.X.X:3000
```

### 4️⃣ Prueba

1. Abre https://gestion-de-estanterias.web.app
2. Flujo: Ubica → TEXTO/CODIGO BARRAS
3. Escribe: `02217`
4. Debería buscar sin errores CORS

## 🔍 Debugging

### Ver logs del Proxy
```bash
# Terminal donde corre proxy-server.js
[PROXY] Buscando: OF26-02217 → http://10.0.0.19:8000/ControlOfProduccion/...
[PROXY] ✓ Encontrado: 27894-05
```

### Verificar que funciona
```bash
# Terminal
curl http://localhost:3000/health
# Respuesta esperada: {"status":"OK","message":"Proxy server is running"}
```

### Test manual
```bash
curl "http://localhost:3000/api/articulo?orderFab=OF26-02217"
# Respuesta esperada: {"success":true,"articulo":"27894-05"}
```

## 📊 Arquitectura

```
┌─────────────────────────────────────┐
│ Frontend (HTTPS)                    │
│ https://gestion-de-estanterias.app │
└──────────────┬──────────────────────┘
               │
               │ fetch("http://localhost:3000/api/articulo?...")
               │
┌──────────────▼──────────────────────┐
│ Proxy Server (HTTP)                 │
│ http://localhost:3000               │
│ (Express + CORS middleware)         │
└──────────────┬──────────────────────┘
               │
               │ fetch("http://10.0.0.19:8000/...")
               │
┌──────────────▼──────────────────────┐
│ API Real (HTTP)                     │
│ http://10.0.0.19:8000               │
│ ControlOfProducción/fichajes/...    │
└─────────────────────────────────────┘
```

## ⚡ Ventajas

✅ **Sin CORS errors** - Proxy maneja CORS correctamente
✅ **Independiente de Firebase** - No depende de Cloud Functions
✅ **Local en la LAN** - Funciona sin internet (si está en red)
✅ **Fácil de testear** - Puedes ver logs en tiempo real
✅ **Rápido** - Sin latencia de cloud, todo local

## 🚀 Para Producción

Si necesitas en producción:
- Opción 1: Desplegar un servidor Express similar en tu servidor de producción
- Opción 2: Solicitar a tu proveedor de API que habilite CORS
- Opción 3: Migrar a una API que soporte HTTPS + CORS

---

**¿Preguntas?** Revisa los logs del proxy y prueba con curl.
