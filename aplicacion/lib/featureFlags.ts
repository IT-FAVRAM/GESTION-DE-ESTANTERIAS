/**
 * Interruptores de funcionalidades de la app.
 *
 * Sirven para ocultar algo de la interfaz SIN borrar su código, de modo que
 * volver a activarlo sea cambiar `false` por `true` en un único sitio.
 */

/**
 * Escaneo de códigos con la CÁMARA (QR / barras).
 *
 * Desactivado el 2026-07-21: el ERP no puede generar etiquetas QR que lleven
 * juntos el número de OF y el código de artículo, así que este flujo no tiene
 * de dónde leer. En su lugar, el operario escribe la OF y el artículo se
 * autorrellena desde el ERP (ver `hooks/useOfLookup.ts`).
 *
 * ⚠️ Esto NO afecta a la pistola USB de códigos de barras. La pistola escribe
 * directamente en el campo de texto y su contenido se interpreta con
 * `lib/qrParser.ts` (separadores `//` y `|`), un camino distinto que sigue
 * plenamente operativo.
 *
 * Para reactivarlo: pon `true`. Los componentes `CameraQRScanner` y `QRScanner`
 * siguen en el repositorio, intactos.
 */
export const FEATURE_CAMERA_QR_SCAN = false;
