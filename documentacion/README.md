# Documentación

Índice de todo lo que está escrito sobre la aplicación. Si es la primera vez, empieza por
**Cómo funciona** y **Guías**.

## Cómo funciona (`funcional/`)

Qué debe hacer la app, explicado desde el punto de vista del usuario.

| Documento | Trata de |
|---|---|
| [kiosco.md](funcional/kiosco.md) | Qué hace un operario en el kiosko: ubicar, retirar, mover y solicitar recogida |
| [roles.md](funcional/roles.md) | Qué puede hacer cada rol (operario, carretillero, calidad, admin, super admin) |
| [carros.md](funcional/carros.md) | Cómo funcionan los carros, que no son estanterías normales |
| [formato.md](funcional/formato.md) | Cómo se dibuja cada estantería en pantalla |
| [finalizacion-articulo.md](funcional/finalizacion-articulo.md) | Cómo termina el recorrido de un artículo y pasa a almacén |

## Guías (`guias/`)

| Documento | Trata de |
|---|---|
| [MANUAL_KIOSKO_WMS.pdf](guias/MANUAL_KIOSKO_WMS.pdf) | Manual del kiosko para el operario |
| [KIOSK_SETUP_GUIDE.md](guias/KIOSK_SETUP_GUIDE.md) | Cómo configurar un kiosko |
| [MOBILE_FEATURES_GUIDE.md](guias/MOBILE_FEATURES_GUIDE.md) | Funciones pensadas para el móvil |
| [OFFLINE_GUIDE.md](guias/OFFLINE_GUIDE.md) | Funcionamiento sin conexión |

## Técnica (para quien programa)

| Documento | Trata de |
|---|---|
| [arquitectura/auth-v3.md](arquitectura/auth-v3.md) | Contrato técnico de sesión y capacidades |
| [arquitectura/calidad-v3.md](arquitectura/calidad-v3.md) | Contrato técnico del rol Calidad |
| [`.claude/project/ARCHITECTURE.md`](../.claude/project/ARCHITECTURE.md) | Arquitectura general, colecciones y flujos |
| [`.claude/project/FIRESTORE_SCHEMA.md`](../.claude/project/FIRESTORE_SCHEMA.md) | Colecciones de la base de datos |
| [`.claude/project/DEPLOY_CHECKLIST.md`](../.claude/project/DEPLOY_CHECKLIST.md) | Lista de comprobación antes y después de publicar |
| [`.claude/project/DEBUGGING_GUIDE.md`](../.claude/project/DEBUGGING_GUIDE.md) | Fallos frecuentes y cómo resolverlos |
| [`.claude/project/RULES.md`](../.claude/project/RULES.md) | Qué puede romper qué, y la regla de no desplegar sin permiso |

## Histórico

Notas y planes de trabajo ya realizados. Sirven para entender **por qué** se hizo algo, no para usar la app.

- [`planes/`](planes/): planes de cambios concretos (por fecha).
- [`sesiones/`](sesiones/): resúmenes de sesiones de trabajo.
