# Admin Tabs, Reports And Location Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** hacer que las vistas admin/superadmin funcionen como áreas independientes, añadir detalle al pulsar ubicaciones y convertir Informes en una pantalla mucho más potente.

**Architecture:** el acceso admin parte desde `AdminHomeView`, así que la forma más segura de aislar pestañas es abrir `SuperAdminPanel` en modo de pestaña bloqueada desde el home, ocultando la navegación transversal dentro del panel. El detalle de ubicación se implementa reutilizando el drawer existente de kiosko en el navegador visual de estanterías, y la pestaña Informes se refuerza consumiendo `useAnalytics()` para mostrar KPIs, alertas y tablas accionables además de la exportación a Excel.

**Tech Stack:** React 19, TypeScript, Vite, Firebase Firestore, Tailwind CSS, xlsx.

---

## File Map

- Modify: `app/web/AppV3.tsx`
- Modify: `app/web/components/admin/SuperAdminPanel.tsx`
- Modify: `app/web/components/admin/AdminShelfBrowser.tsx`
- Modify: `app/web/components/admin/InventoryReport.tsx`
- Verify: `app/web/components/app/AdminHomeView.tsx`
- Verify: `app/web/hooks/useAnalytics.ts`

### Task 1: Aislar pestañas admin

**Files:**
- Modify: `app/web/AppV3.tsx`
- Modify: `app/web/components/admin/SuperAdminPanel.tsx`

- [ ] Añadir un prop de modo aislado al panel admin.
- [ ] Ocultar la barra de tabs cuando el panel se abre desde una tarjeta concreta del home.
- [ ] Mantener solo cabecera + botón volver/cerrar + contenido de la pestaña actual.
- [ ] Garantizar que `Informes` no permite saltar a `Analytics`, `Assistant`, `Devices`, `Users`, etc. desde dentro del panel.

### Task 2: Abrir detalle al pulsar una ubicación en admin/superadmin

**Files:**
- Modify: `app/web/components/admin/AdminShelfBrowser.tsx`

- [ ] Añadir estado `selectedCell` al navegador admin.
- [ ] Pasar un `onCellPress` real a `ShelfGrid` que abra el drawer solo si la celda no está vacía.
- [ ] Reutilizar `KioskCellDetailDrawer` para mostrar artículos, OF y fecha desde modo solo lectura.

### Task 3: Potenciar Informes

**Files:**
- Modify: `app/web/components/admin/InventoryReport.tsx`
- Verify: `app/web/hooks/useAnalytics.ts`

- [ ] Añadir cabecera fuerte con resumen operativo.
- [ ] Mostrar KPIs principales: artículos únicos, ocupación, ubicaciones ocupadas, duplicidades y piezas envejecidas.
- [ ] Añadir bloques de “secciones más saturadas”, “estanterías críticas” y “artículos estancados”.
- [ ] Mantener la exportación Excel como acción principal, no como único contenido.
- [ ] Evitar accesos cruzados a otras áreas desde Informes.

### Task 4: Verificación

**Files:**
- Verify: `app/web/package.json`

- [ ] Ejecutar `npm --prefix app/web run build`.
- [ ] Verificar manualmente: abrir Informes, volver al home, abrir otra tarjeta, comprobar que cada una queda aislada.
- [ ] Verificar manualmente: pulsar una ubicación ocupada en Estanterías admin y ver el drawer.
