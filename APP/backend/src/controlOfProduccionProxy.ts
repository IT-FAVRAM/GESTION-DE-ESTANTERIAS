/**
 * Proxy para ControlOfProducción API
 *
 * Actúa como intermediario para solicitudes a la API externa en 10.0.0.19:8000
 * Esto evita problemas de Mixed Content (HTTPS frontend → HTTP backend)
 *
 * El backend puede hacer solicitudes HTTP a IPs internas sin restricciones,
 * mientras que el frontend no puede.
 */

import * as functions from 'firebase-functions';
import * as cors from 'cors';

const CONTROL_OF_PRODUCCION_URL = 'http://10.0.0.19:8000/ControlOfProduccion/fichajes/getControlOfProduccion';
const REQUEST_TIMEOUT = 5000; // 5 segundos

// CORS middleware configurado para permitir solicitudes desde cualquier origen
const corsHandler = cors({
  origin: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true,
});

/**
 * Cloud Function proxy para buscar artículo por OF
 *
 * HTTP endpoint (onRequest) con CORS explícito mediante middleware
 * GET /proxyControlOfProduccion?orderFab=OF26-02217
 * Response: { "success": true, "articulo": "27894-05" } o error
 */
export const proxyControlOfProduccion = functions.https.onRequest(
  (req, res) => {
    // Aplicar CORS middleware
    corsHandler(req, res, async () => {
      try {
        const { orderFab } = req.query;

        // Validar entrada
        if (!orderFab || typeof orderFab !== 'string') {
          res.status(400).json({
            success: false,
            error: 'orderFab es requerido y debe ser string',
          });
          return;
        }

        // Validar formato OF
        if (!/^OF26-\d{5}$/.test(orderFab)) {
          res.status(400).json({
            success: false,
            error: 'Formato de OF inválido. Esperado: OF26-XXXXX',
          });
          return;
        }

        // Hacer solicitud con timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

        try {
          const response = await fetch(`${CONTROL_OF_PRODUCCION_URL}?orderFab=${encodeURIComponent(orderFab)}`, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'Firebase-Backend/1.0',
            },
            // @ts-ignore - AbortSignal funciona en Node 22
            signal: controller.signal as any,
          });

          clearTimeout(timeoutId);

          // Manejar respuesta de la API
          if (!response.ok) {
            if (response.status === 404) {
              res.status(404).json({
                success: false,
                error: 'Artículo no encontrado',
              });
              return;
            }
            res.status(502).json({
              success: false,
              error: `API respondió con ${response.status}`,
            });
            return;
          }

          const apiData: any = await response.json();

          // Extraer artículo de la respuesta
          // Esperamos estructura como { "articulo": "27894-05" }
          if (apiData && apiData.articulo) {
            res.json({
              success: true,
              articulo: apiData.articulo,
            });
            return;
          }

          res.status(400).json({
            success: false,
            error: 'Respuesta inválida de API',
          });
        } catch (err: any) {
          clearTimeout(timeoutId);

          if (err?.name === 'AbortError') {
            res.status(504).json({
              success: false,
              error: 'Búsqueda tardó demasiado (timeout)',
            });
            return;
          }

          res.status(502).json({
            success: false,
            error: `Error al conectar con API: ${err?.message || 'unknown'}`,
          });
        }
      } catch (error: any) {
        console.error('[proxyControlOfProduccion] Error:', error);
        res.status(500).json({
          success: false,
          error: 'Error interno del servidor',
        });
      }
    });
  }
);
