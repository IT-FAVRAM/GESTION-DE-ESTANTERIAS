# Sesion De Reorganizacion - 2026-04-21

## Objetivo

Mover el codigo operativo a `app/` y dejar la raiz para configuracion, Firebase y documentos generales.

## Resultado

- Frontend principal en `app/web`.
- Cloud Functions en `app/functions`.
- Scripts en `app/scripts`.
- Tests en `app/tests`.
- Documentacion funcional en `app/docs`.
- Utilidades locales en `app/tools`.

## Ajustes Clave

- `firebase.json` apunta a `app/web/dist` y `app/functions`.
- `.husky/pre-commit` valida `npm --prefix app/web run typecheck`.
- `app/functions/package.json` compila con TypeScript compartido desde `app/web/node_modules`.
- `app/scripts/seedDatabase.ts` actualizo imports hacia `app/web/lib`.
- `README.md` y `CONTRIBUTING.md` se alinearon con la nueva estructura.

## Estado Verificado En Esa Sesion

- `npm --prefix app/web run build`: OK.
- `npm --prefix app/functions run build`: OK.

## Deuda Detectada

- Seguia existiendo mezcla de codigo V3 y legacy en `app/web`.
- `app/docs` seguia mezclando planes, auditorias y verificacion.
- El seed seguia incompleto para arranque real.
- Seguridad Firestore, offline real y modularizacion backend quedaban pendientes.

## Vigencia Actual

Esta sesion sigue siendo util como hito historico, pero el estado operativo vigente debe leerse en `ESTADO_ACTUAL_CAMBIO_WMS.md` y `PLAN_IMPLEMENTACION_WMS_HASTA_FUNCIONAMIENTO.md`.
