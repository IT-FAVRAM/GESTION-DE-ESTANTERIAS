# Engram - 2026-04-24 - Primer bloque Firebase

## Objetivo de la sesion

Iniciar el cierre operativo del nuevo plan WMS atacando primero la base tecnica: reglas Firestore, auth, roles y comportamiento de dispositivos.

## Cambios hechos

- Se endurecio `firestore.rules` para reducir superficie abierta y separar mejor lectura/escritura por coleccion.
- Se elimino en `useAuth` la resolucion de usuario por listado completo de `users`, quedando como fuente de verdad el documento `/users/{uid}`.
- Se definio un estado de dispositivo `unassigned` para bloquear dispositivos registrados pero sin configuracion valida.
- Se bloqueo el acceso operativo cuando un kiosko no tiene estanteria asignada o cuando un dispositivo intenta entrar en un modo que no le corresponde.
- Se elimino el fallback peligroso de `KioskView` a `MEC` cuando no habia estanteria asignada.
- Se incorporo el listado real de `USUARIOS INICIALES.xlsx` al seed de Firestore.
- Se actualizo la cuenta de calidad a `calidad@favram.com` como cuenta compartida para push en varios dispositivos.
- Se ajustaron SuperAdmin/Admin/Jefes segun el Excel y se anadio la seccion `PRENSAS` al esquema tipado.
- Se creo `app/scripts/provisionInitialAuthUsers.cjs` para provisionar usuarios reales en Firebase Auth y sincronizar sus documentos en Firestore leyendo directamente el Excel.
- Se ejecuto el script en modo `--dry-run` y parsea correctamente los 14 usuarios iniciales.
- Se encontro la cuenta de servicio en `app/gestion-de-estanterias-firebase-adminsdk-fbsvc-df24389908.json` y se ejecutó el provisionado real de los 14 usuarios iniciales en Firebase Auth + Firestore.
- Se mejoro `app/web/hooks/useShelf.ts` para operar por `presenceId`, limitar movimientos/retiradas a la estanteria actual, evitar posiciones destino duplicadas y no corromper agregados historicos al retirar o mover.
- Se mejoro la visual principal de estanterias para tablet en `app/web/components/kiosk/KioskView.tsx` y `app/web/components/kiosk/ShelfGrid.tsx`, con una presentacion mas cercana a la vista final de kiosko: cabecera operativa, resumen visual, zonas en tarjetas y botones de accion mas grandes.
- Se analizo `COPIA SEGURA ESTANTERIAS.zip` y se empezo a recrear su logica visual en la app nueva: `app/web/lib/firestoreSchema.ts` ahora define bloques fisicos por estanteria y `app/web/components/kiosk/ShelfGrid.tsx` ya renderiza layouts fisicos para `PLE`, `SOL`, `RSO`, `REP`, `RPL`, `CAL` y `ZIN` en vez de limitarse a un grid uniforme.
- Se hizo una segunda iteracion visual de `app/web/components/kiosk/ShelfGrid.tsx` inspirada directamente en `components/WarehouseMap.tsx` del backup: celdas mas expresivas, numero fijo en esquina, barcode/OF visibles dentro del hueco, resaltado de multi-ubicacion y bloques con ancho ajustado al mapa real en vez de tarjetas vacias gigantes.

## Decisiones fijadas

- Roles finales confirmados: `OPERARIO`, `CARRETILLERO`, `JEFE_SECCION`, `CALIDAD`, `ADMIN`, `SUPERADMIN`.
- Un dispositivo sin configurar no entra a operar.
- Un kiosko necesita estanteria fija asignada.
- La resolucion de permisos debe apoyarse en Firebase Auth + documento `users/{uid}`.

## Riesgos que siguen abiertos

- Los flujos anonimos siguen teniendo mas permisos de los deseables mientras no se ate de forma fuerte la sesion anonima al dispositivo real.
- El seed sigue creando usuarios Firestore con UIDs de demostracion y aun no crea usuarios Auth reales.
- Las contrasenas del Excel no se han pasado al codigo ni al seed por seguridad; el alta real de Firebase Auth sigue pendiente.
- La cuenta de servicio esta dentro del repo en `app/gestion-de-estanterias-firebase-adminsdk-fbsvc-df24389908.json`, lo cual es un riesgo grave y debe sacarse del repositorio cuanto antes.
- Las Cloud Functions siguen necesitando separacion real por dominio y menos dependencia de `legacy.ts`.
- Offline, push y operaciones de inventario aun requieren cierre posterior.

## Siguiente paso recomendado

1. Completar `Task 3 - Step 5` cerrando dispositivos base y asignaciones iniciales de estanteria.
2. Iniciar `Task 4` para unificar arquitectura Firebase y aislar legacy.
3. Sacar la cuenta de servicio del repo y dejarla solo como secreto local/seguro.
