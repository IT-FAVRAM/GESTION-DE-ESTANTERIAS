# 🏭 Gestor de Estanterías (WMS)

![Status](https://img.shields.io/badge/Status-Active-success?style=for-the-badge)
![React](https://img.shields.io/badge/React-18-blue?logo=react&style=for-the-badge)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript&style=for-the-badge)
![Firebase](https://img.shields.io/badge/Firebase-Supported-orange?logo=firebase&style=for-the-badge)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-Styled-38bdf8?logo=tailwindcss&style=for-the-badge)

> **Sistema Integral de Gestión de Almacén e Inventario en Tiempo Real.**
> Optimiza la logística, reduce errores de stock y agiliza la toma de decisiones con una interfaz moderna y reactiva.

---

## 🚀 Características Principales

| Módulo | Descripción | Beneficio |
| :--- | :--- | :--- |
| **📦 Gestión de Ubicaciones** | Control total de estanterías, pasillos y niveles. | Localización exacta de cada ítem en segundos. |
| **📱 Escaneo Inteligente** | Integración con lectores de códigos de barras y QR. | Entrada y salida de mercancía sin errores manuales. |
| **🔄 Sincronización Real-Time** | Actualizaciones instantáneas vía Firebase. | Todo el equipo ve la misma información al instante. |
| **📊 Dashboard Analítico** | Métricas de ocupación, movimientos y alertas. | Toma de decisiones basada en datos. |
| **🛡️ Control de Roles** | Permisos granulares (Carretillero, Admin, Operario). | Seguridad y trazabilidad de acciones. |

## 📸 Capturas / Demo
*(Placeholder para futuros GIFs o Screenshots de la aplicación funcionando)*
> *Imagina aquí un GIF mostrando el flujo de escaneo y asignación de un producto a una estantería.*

## 🛠️ Tech Stack

El proyecto está construido con una arquitectura moderna enfocada en rendimiento y mantenibilidad:

-   **Frontend:** React 18 + Vite (Velocidad extrema de desarrollo y build).
-   **Lenguaje:** TypeScript (Tipado estricto para reducir bugs).
-   **Estilos:** TailwindCSS (Diseño consistente y responsivo).
-   **Backend / DB:** Firebase Firestore (Base de datos NoSQL en tiempo real) + Auth.
-   **Estado:** Zustand (Gestión de estado global ligera y potente).
-   **Utilidades:** Lucide React (Iconos), React Router (Navegación).

## 🔧 Instalación y Despliegue

### Prerrequisitos
-   Node.js (v18 o superior)
-   npm o yarn

### Pasos
1.  **Clonar el repositorio:**
    ```bash
    git clone https://github.com/Daniel123456139/GESTOR-ESTANTERIAS.git
    cd GESTOR-ESTANTERIAS
    ```

2.  **Instalar dependencias:**
    ```bash
    npm install
    ```

3.  **Configurar Variables de Entorno:**
    Crea un archivo `.env.local` en la raíz con tus credenciales de Firebase:
    ```env
    VITE_FIREBASE_API_KEY=tu_api_key
    VITE_FIREBASE_AUTH_DOMAIN=tu_proyecto.firebaseapp.com
    VITE_FIREBASE_PROJECT_ID=tu_proyecto_id
    # ... resto de credenciales
    ```

4.  **Ejecutar en desarrollo:**
    ```bash
    npm run dev
    ```

## 🤝 Contribuir
¡Las contribuciones son bienvenidas! Consulta nuestra guía [CONTRIBUTING.md](./CONTRIBUTING.md) para empezar.

## 📄 Licencia
Este proyecto está bajo la Licencia [MIT](./LICENSE).

---
<p align="center">
  Hecho con ❤️ por <a href="https://github.com/Daniel123456139">Daniel</a>
</p>
