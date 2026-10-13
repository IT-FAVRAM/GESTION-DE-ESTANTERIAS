# Herramientas del servidor

Scripts de uso puntual que antes estaban mezclados con el código del servidor. **No forman parte de
la aplicación**: no se publican y la app no los necesita para funcionar.

Casi todos se conectan a la base de datos real (Firestore), así que antes de ejecutar uno hay que
leer su cabecera: la mayoría funciona primero en modo "solo informe" y escribe únicamente con `--apply`.

## Qué hay

| Carpeta | Para qué |
|---|---|
| `kioscos/` | Dar de alta, comprobar y ajustar los kioskos (dispositivos). |
| `migraciones/` | Cambios de datos que se hicieron una vez (renombrar secciones, mover estanterías, corregir usuarios). Se conservan como referencia. |
| `utilidades/` | Herramientas reutilizables: limpiar o unificar datos, consultar usuarios, comprobar un despliegue, generar claves. |

## Cómo se ejecutan

- Se lanzan desde la **raíz del repositorio**, por ejemplo
  `node herramientas/servidor/utilidades/unify-of.cjs`.
- Necesitan el fichero `serviceAccount.json` en la raíz del repositorio. Lo entrega informática y
  **nunca** se sube a git.
- Usan las librerías ya instaladas en `servidor/node_modules` (hay que haber hecho `npm install` en
  `servidor/` al menos una vez).

## Aviso

Varios scripts son antiguos y apuntan a carpetas que ya no existen (`web/`, `functions/`), por
ejemplo `migraciones/provisionInitialAuthUsers.cjs`, `migraciones/seedDatabase.ts` o
`utilidades/abrir-app.bat`. Se han conservado tal cual por si hacen falta como referencia.

Los scripts en TypeScript de `servidor/src/scripts/` siguen donde estaban: se compilan junto al
servidor y se ejecutan con `npm run build && node lib/...`.
