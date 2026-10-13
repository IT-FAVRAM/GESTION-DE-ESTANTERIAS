# Gestión de Estanterías

Aplicación de FAVRAM para saber **qué material hay en cada estantería de la fábrica y en qué hueco está**.
Sustituye al papel y a la memoria de cada uno: cualquiera puede ver, desde un kiosko o desde el móvil,
dónde está una pieza y avisar al carretillero para que la recoja.

**Dirección de la app:** <https://gestion-de-estanterias.web.app/>

---

## Qué se puede hacer

Estas cuatro acciones son las que usan a diario los operarios en el kiosko de su sección:

| Acción | Para qué sirve |
|---|---|
| **Ubicar** | Dejar un artículo en un hueco de la estantería. Se escanea el código de barras o QR de la hoja. |
| **Retirar** | Sacar un artículo de la estantería. La app pide confirmación y lo da de baja. |
| **Mover** | Cambiar un artículo de hueco, dentro de la misma sección. |
| **Solicitar recogida** | Avisar al carretillero de que hay material que recoger. Le llega una notificación. |

Además se puede **buscar un artículo** para saber dónde está.

## Quién usa la app

| Rol | Qué hace |
|---|---|
| **Operario** | Usa el kiosko de su sección: buscar, ubicar, retirar, mover y avisar al carretillero. |
| **Carretillero** | Ve todas las estanterías y recibe los avisos para recoger material. |
| **Calidad** | Usa los kioskos, pide recogidas y consulta el estado de su sección desde el ordenador. |
| **Admin** | Ve todas las estanterías y el panel de control con informes y análisis. |
| **Super admin** | Todo lo anterior y además la configuración de la aplicación. |

## Secciones con estantería

Prensas, Mecanizado, Repasado, Soldadura, Pintura, Plegadora, Calidad, Zincado, Autoplegadora y Robot Soldadura.
Cada kiosko arranca ya en la estantería de su sección.

---

## Para el equipo de informática

### Arrancar la app en un ordenador de pruebas

1. Instalar [Node.js](https://nodejs.org/) (versión LTS).
2. Abrir una consola en `aplicacion` y ejecutar `npm install` (solo la primera vez).
3. Copiar `aplicacion\.env.example` a `aplicacion\.env.local` y rellenar los datos de Firebase.
   Ese fichero **no se sube al repositorio**; lo entrega informática.
4. Hacer doble clic en **`INICIAR.bat`**. Se abre <https://localhost:3000>; si el navegador avisa del
   certificado, aceptarlo.

Para preparar un PC nuevo desde cero está `herramientas\scripts\setup-nuevo-pc.bat`.

**El código compilado del servidor (`servidor\lib`) no se guarda en git.** Tras clonar el repositorio hay
que ejecutar `npm install` y `npm run build` en `servidor` (el script de PC nuevo ya lo hace).
Al publicar, Firebase lo compila solo.

### Kioskos

Los `.bat` que empiezan por `KIOSKO_` configuran, lanzan y detienen el kiosko de una sección en Windows.
Se han dejado en esta carpeta a propósito: Windows guarda su ruta en una tarea programada, y si se
movieran dejarían de arrancar solos. La guía completa está en
[`documentacion/guias/KIOSK_SETUP_GUIDE.md`](documentacion/guias/KIOSK_SETUP_GUIDE.md) y el manual en
[`documentacion/guias/MANUAL_KIOSKO_WMS.pdf`](documentacion/guias/MANUAL_KIOSKO_WMS.pdf).

### Conexión con el ERP

La carpeta [`bridge/`](bridge/README.md) contiene un pequeño servicio que conecta la app con el ERP
para rellenar solos los datos de un artículo a partir de la OF. Es un servicio de Windows con ruta fija,
por eso tampoco se ha movido.

### Regla importante: nada se despliega sin permiso

**Nunca** se publica nada en Firebase (`firebase deploy`, en cualquiera de sus variantes) sin que Dani
Soler lo haya autorizado expresamente para ese despliegue. Preparar, compilar y probar en local sí está
permitido. Antes de cualquier despliegue, leer [`.claude/project/DEPLOY_CHECKLIST.md`](.claude/project/DEPLOY_CHECKLIST.md).

---

## Dónde está cada cosa

| Carpeta o fichero | Qué contiene |
|---|---|
| `INICIAR.bat` | Arranca la app en este ordenador para probarla. |
| `aplicacion` | La aplicación que ven los usuarios (React + TypeScript). |
| `servidor` | Las funciones de servidor en Firebase (Cloud Functions). |
| `base-de-datos/` | Reglas de seguridad e índices de la base de datos (Firestore). |
| `documentacion/` | Toda la documentación: [ver el índice](documentacion/README.md). |
| `herramientas/` | Scripts de apoyo, copias de seguridad antiguas y utilidades. |
| `bridge/` | Servicio que conecta la app con el ERP. |
| `KIOSKO_*.bat` | Configurar, lanzar y detener los kioskos. |
| `firebase.json`, `.firebaserc` | Configuración de Firebase (proyecto `gestion-de-estanterias`). |

## ¿Algo no funciona o hay dudas?

Avisa a Informática de FAVRAM. Para un fallo técnico conviene indicar qué sección, qué hacías y la hora.
