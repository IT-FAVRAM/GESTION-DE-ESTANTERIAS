# Gestor de Estanterias

La raiz del repo queda reservada para configuracion del repositorio, Firebase y documentacion general. Todo el codigo operativo de la app vive dentro de `app/`.

## Estructura

- `app/web`: frontend Vite + React + TypeScript
  - `app/web/domain/`: logica de dominio pura (auth, reprocesos, visibilidad)
  - `app/web/hooks/`: hooks de React (useShelf, useAuth, usePickupQueue, ...)
  - `app/web/lib/`: utilidades y API clients; esquema Firestore en `lib/schema/`
  - `app/web/components/`: componentes React organizados por contexto (app, kiosk, admin, common)
  - `app/web/legacy/`: shell y componentes legacy congelados, solo para compatibilidad y retirada gradual
- `app/functions`: Cloud Functions de Firebase
- `app/scripts`: scripts auxiliares y seed
- `app/tests`: tests de validacion y regresion
- `docs`: planes, auditorias y documentacion funcional
- `app/tools`: utilidades locales como lanzadores y generadores

## Comandos

Frontend:

```bash
npm --prefix app/web install
npm --prefix app/web run dev
npm --prefix app/web run build
```

Cloud Functions:

```bash
npm --prefix app/functions install
npm --prefix app/functions run build
```

## Entorno

- Variables web: `app/web/.env.local`
- Ejemplo de variables: `app/web/.env.example`
- Configuracion Firebase de despliegue: raiz del repo (`firebase.json`, `firestore.rules`, `firestore.indexes.json`)
