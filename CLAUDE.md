# Gestión de Estanterías (WMS) — definición del proyecto

Instrucciones para Claude Code. Antes de tocar nada, lee este fichero entero.

## Qué es

Aplicación de FAVRAM para saber **qué material hay en cada estantería de la fábrica y en qué hueco
está**. Los operarios la usan desde kioskos (PCs/tablets fijos en cada sección), móviles y ordenadores.

- Producción: <https://gestion-de-estanterias.web.app/> (Firebase Hosting, proyecto `gestion-de-estanterias`).
- Repositorio: `https://github.com/IT-FAVRAM/GESTION-DE-ESTANTERIAS` (privado).
- Responsable: Dani Soler (d.soler@favram.com), Informática de FAVRAM.
- Idioma: toda la interfaz, documentación y mensajes de commit van en **español**.

Acciones de negocio: **Ubicar**, **Retirar**, **Mover**, **Solicitar recogida** (aviso al carretillero),
buscar artículo. Secciones con estantería: Prensas, Mecanizado, Repasado, Soldadura, Pintura, Plegadora,
Calidad, Zincado, Autoplegadora y Robot Soldadura.

## Reglas inamovibles

1. **NUNCA desplegar nada sin permiso expreso de Dani para ese despliegue.** Ni `firebase deploy` en
   ninguna variante (hosting, functions, rules, indexes), ni el MCP `firebase_deploy`, ni
   `npm run deploy` en `servidor`. La app está en uso real ahora mismo. Preparar, compilar y probar en
   local sí está permitido. Antes de cualquier despliegue autorizado: `.claude/project/DEPLOY_CHECKLIST.md`.
2. **Nada de secretos en git.** Quedan fuera: `serviceAccount.json`, `servidor/.env.keys.json`,
   `aplicacion/.env.local`, `base-de-datos/users_import.json`, tokens de GitHub. Ninguna contraseña en
   scripts ni en la documentación.
3. **No tocar datos reales de Firestore** (producción) desde scripts sin autorización de Dani.
4. **`bridge/` y los `KIOSKO_*.bat` no se mueven ni se renombran**: Windows guarda sus rutas absolutas
   (servicio «ERP Bridge WMS» y tarea `WMS_Kiosko_AutoStart`).
5. No usar `git reset --hard` en un kiosko: borra la configuración local de `KIOSKO_LANZAR.bat`.
6. Cambios mínimos y verificados. Un paso cada vez, confirmando con Dani los que sean difíciles de revertir.

## Estructura del repositorio

| Ruta | Contenido |
|---|---|
| `aplicacion/` | Frontend: Vite + React 19 + TypeScript + Tailwind + Zustand. Entrada `index.tsx` → `AppV3.tsx`. |
| `servidor/` | Cloud Functions de Firebase (Node 22, TypeScript). Código en `src/`, compilado en `lib/`. |
| `base-de-datos/` | `firestore.rules`, `firestore.indexes.json`, `storage.rules`. |
| `bridge/` | Servicio de Windows que conecta Firestore con la API del ERP (`10.0.0.19:8000`, solo LAN). |
| `herramientas/` | Scripts de apoyo y utilidades (`scripts/`, `servidor/{kioscos,migraciones,utilidades}`, `backups/`). |
| `documentacion/` | Documentación para personas: índice en `documentacion/README.md`. |
| `.claude/project/` | Mapas para Claude (arquitectura, roles, esquema Firestore, depuración, despliegue). |
| `KIOSKO_*.bat`, `INICIAR*.bat` | Lanzadores de kiosko y arranque local. Siguen en la raíz a propósito. |
| `firebase.json`, `.firebaserc` | Configuración de Firebase (hosting → `aplicacion/dist`, functions → `servidor`). |

### Dentro de `aplicacion/`
`components/` (por vista: `admin`, `app`, `auth`, `carretillero`, `chapero`, `common`, `erp`, `icons`,
`kiosk`, `operative`, `views`), `hooks/` (`useAuth`, `useShelf`, `useOperativeShelf`, `useKiosk`,
`usePickupQueue`…), `domain/` (`auth`, `reprocesos`), `lib/` (`schema/`, `firebase/`, `offline/`,
`optimistic/`, `erp/`, `api/`…), `public/`.

### Dentro de `servidor/`
`src/index.ts` exporta las funciones; módulos por dominio (`inventory`, `carts`, `chapero`, `chat`,
`conversations`, `notifications`, `push`, `ocr`, `urgentAlerts`, `reports`, `admin`…). `src/scripts/` son
utilidades que se compilan con el servidor. `tests/*.cjs` son tests de reglas y de contrato.

## Roles

`OPERARIO` y `CARRETILLERO` entran por **ID numérico** en el kiosko (`KIOSK_ROLES`). `JEFE_SECCION`,
`CALIDAD`, `ADMIN`, `SUPERADMIN`, `SOLO_VISUAL` y `RECEPCIONES` usan **email + contraseña** de Firebase
Auth (`AUTH_ROLES`). Fuente de verdad: `aplicacion/lib/schema/roles.ts` y
`aplicacion/domain/auth/`. Matriz detallada: `.claude/project/ROLES.md`.

## Comandos

Todos desde la carpeta indicada. Instalar dependencias con `npm install` la primera vez.

| Dónde | Comando | Para qué |
|---|---|---|
| `aplicacion` | `npm run dev` (o `INICIAR.bat` en la raíz) | Servidor local en `https://localhost:3000` |
| `aplicacion` | `npm run typecheck` | Comprobar tipos (también lo ejecuta el hook pre-commit de husky) |
| `aplicacion` | `npm test` | Vitest, 115 tests |
| `aplicacion` | `npm run build` | Compilar a `aplicacion/dist` (no publica nada) |
| `servidor` | `npm run build` | Compilar a `servidor/lib` con `tsc` |
| `servidor` | `node tests/<fichero>.cjs` | Tests de reglas/contrato (ver aviso abajo) |

`servidor/lib` **no está en git** salvo `lib/index.js` (el `main`, escrito a mano). Tras clonar hay que
ejecutar `npm install` y `npm run build` en `servidor`.

## Verificación antes de dar algo por terminado

1. `npm run typecheck` y `npm test` en `aplicacion`.
2. `npm run build` en `aplicacion` si se tocó código del frontend; `npm run build` en `servidor` si se
   tocó el servidor.
3. Si se tocan `firestore.rules`, ejecutar los tests `.cjs` de reglas de `servidor/tests`.
4. Si se mueve un fichero con `git mv`, buscar con grep todas las referencias (imports, `.bat`,
   `firebase.json`, README, documentación) y comprobar que no queda ninguna ruta rota.

## Estado conocido (no es un fallo nuevo)

- De los 35 tests `.cjs` de `servidor/tests`, **29 fallan desde antes** porque buscan carpetas `web/` y
  `functions/` que ya no existen; los 6 que pasan son el listón mínimo.
- `servidor/package.json` → script `report:users-push` apunta a un fichero que no existe.
- Scripts antiguos con rutas `web/` y `functions/`: `provisionInitialAuthUsers.cjs`, `seedDatabase.ts`,
  `runSeed.ts` y `abrir-app.bat` (en `herramientas/servidor`).
- `aplicacion/tsconfig.json` aún excluye `legacy/**/*` (la carpeta ya no existe; es inofensivo).
- Algunos documentos de `.claude/project/` y `documentacion/` conservan nombres de carpeta anteriores
  (`APP/frontend`, `servidor/functions`, `config/`). Ante la duda, manda el código.
- La reorganización de carpetas vive en la rama `renombrar-carpetas` (pendiente de fusionar en `main`
  por orden de Dani).

## Hacia dónde va el proyecto

Dani quiere **migrar más adelante de Firestore a una base de datos local**. Por eso se está dejando el
repositorio limpio y con nombres no técnicos. Al diseñar o tocar código de datos: mantener el acceso a
Firestore concentrado en `aplicacion/lib/` (`firebase`, `api`, `schema`) y en `servidor/src/`, y no
esparcir llamadas nuevas a Firestore por los componentes.

## Más documentación

- Para personas: `README.md` y `documentacion/README.md`.
- Para Claude: `.claude/project/ARCHITECTURE.md`, `ROLES.md`, `RULES.md`, `FIRESTORE_SCHEMA.md`,
  `DEBUGGING_GUIDE.md`, `DEPLOY_CHECKLIST.md`, `CLAUDE_GUIDE.md`.
- Kioskos y bridge: `documentacion/guias/ACTUALIZAR_KIOSKOS_Y_BRIDGE.md`, `bridge/README.md`.
