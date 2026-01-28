# Guía de Contribución

¡Gracias por tu interés en contribuir a **Gestor de Estanterías**! 🚀
Este documento establece las pautas para asegurar que tu contribución sea efectiva y mantenga la calidad del proyecto.

## 🛠️ Cómo empezar

1.  **Haz un Fork** del repositorio.
2.  **Clona** tu fork localmente:
    ```bash
    git clone https://github.com/tu-usuario/GESTOR-ESTANTERIAS.git
    cd GESTOR-ESTANTERIAS
    ```
3.  **Crea una rama (branch)** para tu feature o fix:
    ```bash
    git checkout -b feature/mi-nueva-feature
    # o
    git checkout -b fix/arreglo-bug
    ```

## 💻 Desarrollo

### Estándares de Código
- **React + TypeScript**: Usamos tipos estrictos. Evita `any` siempre que sea posible.
- **Clean Code**: Mantén los componentes pequeños y con una única responsabilidad.
- **Hooks**: Extrae la lógica compleja a custom hooks en la carpeta `hooks/`.
- **Estilos**: Nos basamos en **TailwindCSS**. Evita estilos en línea o archivos CSS externos salvo excepciones.

### Estructura de Carpetas
- `/components`: Componentes de UI reutilizables.
- `/hooks`: Lógica de negocio y efectos.
- `/lib`: Utilidades, configuración de Firebase y constantes.
- `/pages` (o rutas en `/components/Routes`): Vistas principales de la aplicación.

## 🧪 Pruebas
Antes de enviar tu código:
1.  Asegúrate de que el proyecto compila sin errores: `npm run build`.
2.  (Opcional) Ejecuta los tests si existen: `npm test`.

## 📬 Enviar un Pull Request (PR)

1.  Haz **Push** a tu rama:
    ```bash
    git push origin feature/mi-nueva-feature
    ```
2.  Abre un **Pull Request** en GitHub describiendo claramente tus cambios.
3.  Usa capturas de pantalla o GIFs si tus cambios son visuales.

## 🤝 Conducta
Sé respetuoso y colaborativo. Estamos aquí para aprender y mejorar juntos.

---
¡Esperamos tus contribuciones!
