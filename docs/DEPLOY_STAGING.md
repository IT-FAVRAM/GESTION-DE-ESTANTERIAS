# Instrucciones de Despliegue (Staging)

## Prerrequisitos
1. **VAPID Key**: Asegurar que `VITE_FIREBASE_VAPID_KEY` está definido en `.env.local` o variables de entorno de CI/CD.
2. **Firebase CLI**: Tener `firebase-tools` instalado y logueado (`firebase login`).

## Pasos

### 1. Desplegar Cloud Functions
Esto desplegará la lógica de backend para notificaciones.
```bash
firebase deploy --only functions
```
*Si es la primera vez, puede tardar unos minutos en instalar dependencias.*

### 2. Desplegar Hosting (Frontend + SW)
Esto desplegará la PWA actualizada y el Service Worker.
```bash
firebase deploy --only hosting
```

### 3. Verificación Post-Despliegue
1. **Service Worker**:
   Accede a la URL de staging y verifica en DevTools > Application > Service Workers que `firebase-messaging-sw.js` está activo y actualizado.
   
2. **Headers Cache**:
   Ejecuta: `curl -I https://[STAGING_URL]/firebase-messaging-sw.js`
   Debe devolver: `Cache-Control: no-cache, no-store, must-revalidate`

3. **Prueba Funcional**:
   - Loguearse como CARRETILLERO en PC.
   - Activar notificaciones en perfil.
   - Cerrar pestaña.
   - Crear solicitud desde otro usuario.
   - Verificar notificación nativa.
