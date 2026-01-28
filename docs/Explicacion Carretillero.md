# Guía de Usuario - Carretilleros 🚜

## ¿Qué es esta aplicación?

Sistema de Gestión de Estanterías para optimizar el control de inventario. Como **Carretillero**, eres el responsable principal de **mover, asignar y organizar** los artículos en toda la planta.

---

## 🎯 Tus Permisos y Capacidades

Como Carretillero, puedes:

- ✅ **Escanear artículos** con la cámara o escáner
- ✅ **Asignar artículos** a cualquier ubicación de cualquier almacén
- ✅ **Mover artículos** entre ubicaciones
- ✅ **Retirar artículos** de CUALQUIER ubicación (sin restricciones)
- ✅ **Finalizar producción** y enviar artículos al almacén
- ✅ **Ver solicitudes** de los Jefes de Sección
- ✅ **Exportar inventario** a Excel
- ✅ **Acceder a conteo de chaperos**
- ❌ **NO puedes**: Editar la estructura de almacenes (solo ADMIN)
- ❌ **NO puedes**: Realizar solicitudes de artículos (solo JEFES)

---

## 📋 Funcionalidades Principales

### 1️⃣ **Asignar Artículos a Ubicaciones**

Este es tu flujo de trabajo principal cuando recibes un artículo:

**Método 1 - Escaneo Completo:**
1. Recoge el artículo físicamente
2. Identifica la ubicación de destino (ej: "MEC 005")
3. En la app, haz clic en **"Escanear"** 📷
4. Escanea el **código de barras** del artículo
5. Escanea o captura la **etiqueta de ubicación** con la cámara
6. Si la ubicación está **vacía**, el sistema te pedirá el **tipo de embalaje**:
   - 🏗️ **PALLET** (artículos pesados, palets)
   - 📦 **CAJA GRANDE** (cajas grandes)
   - 📦 **CAJA PEQUEÑA** (cajas pequeñas)
7. Confirma la asignación ✅

**Método 2 - Desde Lista:**
1. Navega al almacén deseado (MEC, PLE, SOL, etc.)
2. Haz clic en **"+"** en la ubicación vacía
3. Escanea o introduce manualmente el artículo
4. Confirma

**Ubicación Ocupada - ¿Qué hacer?**
Si intentas asignar a una ubicación que ya tiene artículos, el sistema preguntará:
- **Unificar lote**: Agregar al mismo lote existente (mismo artículo, mismo pedido)
- **Nuevo lote**: Crear un lote diferente en la misma ubicación (artículo diferente)

---

### 2️⃣ **Mover Artículos Entre Ubicaciones**

Cuando necesites reorganizar:

**Paso a paso:**
1. Haz clic en **"Mover"** en el artículo (desde la lista)
2. O usa **"Escanear"** y después selecciona "Mover"
3. Escanea la **nueva ubicación de destino**
4. El sistema:
   - Retira el artículo de la ubicación original
   - Lo asigna a la nueva ubicación
   - Registra el movimiento en el historial

---

### 3️⃣ **Retirar Artículos**

Para quitar un artículo del sistema:

**Opción A - Escaneo:**
1. Haz clic en **"Retirar Artículo"** ❌
2. Escanea el código de barras
3. El sistema detecta automáticamente su ubicación
4. Confirma la retirada

**Opción B - Desde Lista:**
1. Localiza el artículo en la lista de una ubicación
2. Haz clic en el botón **"Eliminar"** 🗑️
3. Confirma la acción

> **Ventaja**: A diferencia de los Jefes, tú puedes retirar de **CUALQUIER sección** sin restricciones.

---

### 4️⃣ **Atender Solicitudes de los Jefes**

Los Jefes de Sección te enviarán solicitudes cuando necesiten artículos:

**¿Cómo verlas?**
1. Haz clic en el **icono de campana** 🔔 (en la parte superior)
2. O navega a **"Solicitudes Pendientes"** en el menú
3. Verás una lista de:
   - Artículo solicitado
   - Pedido (OF)
   - Jefe que lo solicitó
   - Hora de solicitud

**¿Cómo atenderlas?**
1. Localiza el artículo físicamente (usa la app para ver su ubicación)
2. Retíralo de su ubicación actual
3. Llévalo al Jefe solicitante
4. El Jefe lo asignará a su nueva ubicación

> **Notificaciones**: Recibirás un **banner rojo** en la parte superior cuando haya solicitudes pendientes.

---

### 5️⃣ **Finalizar Producción**

Cuando un artículo completa su proceso:

1. Haz clic en **"Producción Finalizada"** ✅
2. Escanea el artículo
3. El sistema:
   - Lo retira automáticamente de su ubicación
   - Lo marca como **FINALIZADO**
   - Lo registra en "Almacén" (inventario terminado)

---

### 6️⃣ **Asignación Masiva (Multi-Ubicación)**

Para asignar el **mismo artículo a múltiples ubicaciones** a la vez:

1. Haz clic en **"Asignar Multi-Ubicación"** 📍
2. Selecciona las ubicaciones de destino (ej: MEC 010, MEC 011, MEC 012)
3. Escanea el artículo
4. El sistema lo asignará a TODAS las ubicaciones seleccionadas simultáneamente

**Útil para**: Artículos de gran volumen distribuidos en varias ubicaciones.

---

### 7️⃣ **Búsqueda y Filtros**

Para localizar artículos rápidamente:

- **Buscador superior**: Introduce código de barras o número de OF
- **Filtro por almacén**: Focalízate en un área (MEC, SOL, PLE, etc.)
- **"Solo Vacías"**: Muestra únicamente ubicaciones disponibles para asignar

---

### 8️⃣ **Exportar Inventario a Excel**

Para generar reportes:

1. Haz clic en el icono **Excel** 📊
2. El archivo incluirá:
   - Todas las ubicaciones
   - Artículos asignados
   - Estados de producción
   - Tipos de embalaje

---

## 🏭 Almacenes Disponibles

Tienes acceso completo a todos los almacenes:

| **Código** | **Nombre** | **Uso** |
|-----------|----------|---------|
| **MEC** | Mecanizado | Piezas mecanizadas |
| **PLE** | Plegado | Piezas plegadas, carros C1/C2 |
| **SOL** | Soldadura | Piezas para soldar |
| **RSO** | Robot Soldadura | Soldadura robotizada |
| **REP** | Repasado | Acabados, repasado |
| **PIN** | Pintura | Piezas pintadas |
| **SXP** | Soldadura Puntos | Soldadura por puntos |
| **COM** | Comodín | Uso flexible |
| **RPL** | Robot Plegado | Plegado robotizado |
| **CAL** | Calidad | Control de calidad |
| **ZIN** | Zincado | Piezas zincadas (baldas) |

---

## 💡 Casos de Uso Comunes

### ✅ **Recibo un artículo nuevo - ¿Dónde lo pongo?**
1. Pregunta al Jefe de Sección correspondiente o sigue la lógica:
   - Piezas mecanizadas → **MEC**
   - Piezas para plegado → **PLE** o **RPL**
   - Piezas para soldar → **SOL**, **RSO** o **SXP**
   - Acabados → **REP**, **PIN**, **ZIN**
2. Usa **"Solo Vacías"** para encontrar ubicaciones libres
3. Asigna el artículo

### ✅ **Un Jefe me solicita un artículo**
1. Ve a **"Solicitudes"** 🔔
2. Localiza el artículo en la app (usa el buscador)
3. Retíralo de su ubicación
4. Llévalo al Jefe

### ✅ **Necesito reorganizar un almacén**
1. Usa la función **"Mover"** para cambiar artículos de ubicación
2. O usa **"Retirar"** + **"Asignar"** si prefieres dos pasos

### ✅ **Me equivoqué de ubicación**
1. Localiza el artículo en la lista
2. Haz clic en **"Mover"**
3. Escanea la ubicación correcta

---

## 🔒 Restricciones

- ❌ **NO puedes editar** la estructura de estanterías (crear/eliminar ubicaciones)
- ❌ **NO puedes realizar solicitudes** de materiales (solo Jefes)
- ✅ **SÍ puedes retirar** artículos de cualquier sección sin restricción
- ✅ **SÍ puedes asignar** a cualquier ubicación de cualquier almacén

---

## 📱 Consejos Prácticos

1. **Mantén el scanner limpio**: La cámara debe leer códigos claramente
2. **Verifica siempre el pedido (OF)**: Asegúrate de que coincide con el físico
3. **Usa Multi-Ubicación** para artículos distribuidos en varias posiciones
4. **Revisa las solicitudes** regularmente para no retrasar a los Jefes
5. **Registra el tipo de embalaje** correctamente (facilita la organización)

---

## 🆘 Soporte

Si encuentras problemas:
- Contacta al **Administrador** del sistema
- Revisa el **Historial** para verificar movimientos previos
- Usa la **búsqueda** para localizar artículos perdidos

---

**Versión del sistema**: 2.0  
**Última actualización**: Enero 2026
