# Actualizar kioskos y el PC del bridge tras la reorganización del repositorio

Guía para informática. Explica qué hay que hacer (casi siempre, **nada**) en los PCs de los
kioskos y en el PC del bridge ERP cuando se publique la reorganización del repositorio.

## Primero: qué ha cambiado y qué no

| | ¿Cambia? |
|---|---|
| La aplicación publicada (<https://gestion-de-estanterias.web.app/>) | **No.** La reorganización no despliega nada. |
| `KIOSKO_*.bat` e `INICIAR*.bat` | **No se han movido.** Siguen en la raíz del repositorio. |
| Carpeta `bridge/` | **No se ha movido.** Solo cambia un comentario en `bridge/index.js`. |
| Carpetas internas | Sí: `APP/frontend` → `aplicacion`, `APP/backend` → `servidor`, `config` → `base-de-datos`, `docs` → `documentacion`. |
| Historial de git | Sí: se limpió de contraseñas. Los clones antiguos **no pueden hacer `git pull`**. |

## Kioskos

Un kiosko abre la web publicada en Chrome o Edge. **No ejecuta el código del repositorio**; los
`.bat` solo son lanzadores. Por eso:

### Caso A: el PC del kiosko no tiene carpeta `.git` (solo copió los `.bat`)
**No hay que hacer nada.** Sigue funcionando exactamente igual.

### Caso B: el PC del kiosko tiene un clon del repositorio (hay carpeta `.git`)
Tampoco es urgente: el kiosko seguirá funcionando. Solo hay que tocarlo si se quiere recibir
cambios futuros de los `.bat`.

Si el clon es del repositorio **antiguo** (`Daniel123456139/GESTOR-ESTANTERIAS`), o de una versión anterior a la limpieza del historial, `git pull` fallará. (Un clon hecho desde `IT-FAVRAM/GESTION-DE-ESTANTERIAS` hace `git pull` con normalidad.) En ese caso, para alinearlo **sin mover la carpeta** (Windows tiene
guardada su ruta en la tarea `WMS_Kiosko_AutoStart`), desde esa carpeta:

```bat
git remote set-url origin https://github.com/IT-FAVRAM/GESTION-DE-ESTANTERIAS.git
git fetch origin
git reset --mixed origin/main
```

- `--mixed` no borra ni cambia los ficheros del disco: solo actualiza lo que git cree que hay.
- `KIOSKO_LANZAR.bat` aparecerá como modificado: es la sección de ese kiosko. **No lo deshagas.**
- La carpeta `APP\` antigua puede quedar como restos sin seguimiento. Se puede borrar a mano; el
  kiosko no la usa.

Después de cualquier cambio, comprobar que el kiosko arranca con `KIOSKO_AUTO_INICIO.bat`,
opción 3 («Probar el kiosko ahora»).

## PC del bridge ERP

El bridge es un servicio de Windows que apunta a una ruta fija de `bridge/`. Como esa carpeta no se
ha movido y su código no ha cambiado:

- **No hay que reinstalar el servicio.**
- **No hay que cambiar ficheros** (`.env`, clave de servicio, etc.).
- Si el PC tiene un clon con el historial antiguo, se alinea igual que en el caso B de los kioskos
  (`set-url`, `fetch`, `reset --mixed`). No hace falta si no se quiere actualizar.

Para comprobar que sigue bien: ejecutar `bridge\comprobar-equipo.ps1` y mirar `services.msc`
→ **ERP Bridge WMS** en estado «En ejecución».

## PC de pruebas o de desarrollo

Si hay otro PC con el repositorio, lo más limpio es **clonar de nuevo** con
`herramientas\scripts\setup-nuevo-pc.bat`. Después hay que copiar a mano `serviceAccount.json`,
`servidor\.env.keys.json` y `aplicacion\.env.local` (entrega informática, nunca por git).

## Lo que no se debe hacer

- No ejecutar `firebase deploy` (en ninguna variante) sin permiso expreso de Dani Soler.
- No mover ni renombrar `bridge/` ni los `KIOSKO_*.bat`: Windows guarda sus rutas.
- No ejecutar `git reset --hard` en un kiosko: borraría la sección configurada en `KIOSKO_LANZAR.bat`.

## Si algo no funciona

Avisar a Informática de FAVRAM indicando qué PC es, qué se hizo y la hora.
