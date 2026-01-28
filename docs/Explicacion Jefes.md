# Guía de Usuario - Jefes de Sección 👨‍💼

## ¿Qué es esta aplicación?

Sistema de Gestión de Estanterías diseñado para optimizar el control de inventario en planta. Como **Jefe de Sección**, tienes acceso a funcionalidades avanzadas para gestionar tu área específica de producción.

---

## 🎯 Tus Permisos y Capacidades

Como Jefe de Sección, puedes:

- ✅ **Escanear y asignar** artículos a ubicaciones
- ✅ **Realizar solicitudes** de materiales al carretillero
- ✅ **Retirar artículos** de tu sección
- ✅ **Usar filtros avanzados** para búsquedas precisas
- ✅ **Exportar datos** a Excel para análisis
- ✅ **Finalizar producción** y mover artículos al almacén
- ✅ **Acceder a conteo de chaperos** (todos los roles)
- ⚠️ **Limitación**: Solo puedes retirar artículos de TU SECCIÓN

---

## 📋 Funcionalidades Principales

### 1️⃣ **Visualización del Almacén**

Al entrar a la app, verás:
- **Lista de almacenes** (MEC, PLE, SOL, RSO, REP, PIN, etc.)
- **Indicadores de ocupación** en cada ubicación
- **Filtros de búsqueda** por artículo o pedido
- **Vista de mapa interactiva** de estanterías

**¿Cómo navegar?**
- Haz clic en un almacén para ver sus estanterías
- Las ubicaciones en **azul** tienen artículos asignados
- Las ubicaciones **vacías** se muestran en gris
- Puedes buscar artículos usando el buscador superior

---

### 2️⃣ **Solicitar Materiales**

Cuando necesites que el carretillero te traiga un artículo:

**Paso a paso:**
1. Haz clic en **"Realizar Solicitud"** 🔔
2. Escanea el código de barras del artículo O introdúcelo manualmente
3. Verifica el pedido (OF) asociado
4. Confirma la solicitud
5. El carretillero recibirá una **notificación instantánea**

> **Nota:** El carretillero verá tu solicitud en su pantalla "Solicitudes Pendientes"

---

### 3️⃣ **Retirar Artículos de Tu Sección**

Para quitar un artículo de una ubicación:

**Método 1 - Escaneo directo:**
1. Haz clic en **"Retirar Artículo"** ❌
2. Escanea el código de barras
3. El sistema detectará automáticamente su ubicación
4. Confirma la retirada

**Método 2 - Desde la lista:**
1. Navega hasta la ubicación del artículo
2. Haz clic en **"Eliminar"** en la fila del artículo
3. Confirma la acción

⚠️ **IMPORTANTE**: Solo puedes retirar artículos de ubicaciones pertenecientes a tu sección (ej: si eres Jefe de MECANIZADO, solo de almacén MEC).

---

### 4️⃣ **Finalizar Producción**

Cuando un artículo completa su proceso:

1. Haz clic en **"Producción Finalizada"** ✅
2. Escanea el artículo terminado
3. El sistema:
   - Lo retira de la ubicación actual
   - Lo marca como **FINALIZADO**
   - Lo registra en el historial con estado "ALMACÉN"

---

### 5️⃣ **Filtros Avanzados**

Como Jefe, tienes acceso a filtros potentes:

- **Búsqueda por artículo**: Encuentra cualquier código de barras
- **Búsqueda por OF**: Localiza todos los artículos de un pedido
- **Filtro "Solo Vacías"**: Muestra únicamente ubicaciones disponibles
- **Filtro por almacén**: Focalízate en un área específica

---

### 6️⃣ **Exportar a Excel**

Para generar reportes:

1. Haz clic en el icono **Excel** 📊
2. El sistema exportará:
   - Todas las ubicaciones actuales
   - Artículos asignados
   - Fechas de asignación
   - Estados de producción

---

### 7️⃣ **Historial de Movimientos**

Accede al registro completo de operaciones:

- **Pestaña "Historial"**: Ver todas las acciones (asignaciones, movimientos, retiros)
- **Filtrado temporal**: Por fecha específica
- **Detalles**: Quién hizo qué y cuándo

---

## 🏭 Secciones del Almacén

Tu cuenta está asociada a una **sección específica**:

| **Sección** | **Almacenes Relacionados** |
|------------|---------------------------|
| MECANIZADO | MEC |
| PLEGADORA | PLE, RPL (Robot Plegado) |
| SOLDADURA | SOL, RSO (Robot Sold.), SXP (Puntos) |
| REPASADO | REP, PIN (Pintura), ZIN (Zincado) |
| LASER | (Si aplica) |

---

## 💡 Casos de Uso Comunes

### ✅ **Necesito un artículo que está en otra sección**
1. Usa **"Realizar Solicitud"**
2. Escanea o introduce el código
3. El carretillero lo recogerá y te lo traerá

### ✅ **Quiero saber dónde está un artículo**
1. Usa el **buscador** en la parte superior
2. Introduce el código de barras o la OF
3. El sistema destacará su ubicación

### ✅ **Un artículo terminó su proceso en mi sección**
1. Usa **"Producción Finalizada"**
2. Escanea el artículo
3. Quedará registrado como listo para almacén

### ✅ **Necesito un reporte para el turno**
1. Haz clic en **Exportar Excel** 📊
2. Filtra por tu almacén si es necesario
3. Descarga el archivo

---

## 🔒 Restricciones Importantes

- ❌ **NO puedes retirar** artículos de secciones que no te pertenecen
- ❌ **NO puedes editar la estructura** del almacén (solo ADMIN)
- ❌ **NO puedes analizar anomalías** de forma masiva (solo ADMIN)
- ✅ **SÍ puedes solicitar** artículos de cualquier ubicación

---

## 🆘 Soporte

Si tienes problemas técnicos o dudas:
- Contacta al **Administrador** del sistema
- Revisa el **Historial** para verificar acciones previas
- Usa la función de **búsqueda** para localizar artículos perdidos

---

**Versión del sistema**: 2.0  
**Última actualización**: Enero 2026
