/**
 * CORS Proxy Server - Corre localmente para evitar problemas de CORS
 *
 * USO:
 * 1. npm install express cors node-fetch
 * 2. node proxy-server.js
 * 3. El server estará en http://localhost:3000 (o http://192.168.X.X:3000 desde otras máquinas)
 *
 * El frontend hará solicitudes a http://localhost:3000/api/articulo?orderFab=OF26-02217
 */

const express = require('express');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const app = express();
const PORT = 3000;

// Habilitar CORS para TODAS las solicitudes
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: false,
}));

app.use(express.json());

// Endpoint proxy para Control de Producción
app.get('/api/articulo', async (req, res) => {
  try {
    const { orderFab } = req.query;

    if (!orderFab) {
      return res.status(400).json({
        success: false,
        error: 'orderFab es requerido',
      });
    }

    // Validar formato
    if (!/^OF26-\d{5}$/.test(orderFab)) {
      return res.status(400).json({
        success: false,
        error: 'Formato inválido. Esperado: OF26-XXXXX',
      });
    }

    // Llamar a la API REAL
    const apiUrl = `http://10.0.0.19:8000/ControlOfProduccion/fichajes/getControlOfProduccion?orderFab=${encodeURIComponent(orderFab)}`;

    console.log(`[PROXY] Buscando: ${orderFab} → ${apiUrl}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Proxy-Server/1.0',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      if (response.status === 404) {
        return res.status(404).json({
          success: false,
          error: 'Artículo no encontrado',
        });
      }
      return res.status(502).json({
        success: false,
        error: `API respondió con ${response.status}`,
      });
    }

    const data = await response.json();

    // Extraer artículo
    if (data && data.articulo) {
      console.log(`[PROXY] ✓ Encontrado: ${data.articulo}`);
      return res.json({
        success: true,
        articulo: data.articulo,
      });
    }

    console.log(`[PROXY] ✗ Respuesta vacía para ${orderFab}`);
    return res.json({
      success: false,
      error: 'Respuesta inválida de API',
    });

  } catch (error) {
    console.error('[PROXY] Error:', error.message);

    if (error.name === 'AbortError') {
      return res.status(504).json({
        success: false,
        error: 'Timeout: búsqueda tardó demasiado',
      });
    }

    return res.status(502).json({
      success: false,
      error: `Error: ${error.message}`,
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Proxy server is running' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║  CORS PROXY SERVER ACTIVO                                  ║
╠════════════════════════════════════════════════════════════╣
║                                                            ║
║  🌐 http://localhost:${PORT}                              ║
║  🔗 http://192.168.X.X:${PORT} (desde otras máquinas)      ║
║                                                            ║
║  📝 Endpoint: /api/articulo?orderFab=OF26-XXXXX            ║
║  ❤️  Health:  /health                                      ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});

// Manejo de errores no capturados
process.on('uncaughtException', (error) => {
  console.error('[FATAL]', error);
  process.exit(1);
});
