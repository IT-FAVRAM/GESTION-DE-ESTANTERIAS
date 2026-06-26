# Estudio UX/UI — Gestor de Estanterías (WMS)
**Tres visuales: Ordenador de sobremesa · Tablet · Móvil**
Generado con la skill `ui-ux-pro-max` · 2026-06-22

---

## 0. Contexto y método

- **Skill instalada:** `.claude/skills/ui-ux-pro-max/` (vía `uipro-cli` v2.2.3, motor Python BM25 verificado funcionando).
- **App analizada:** React 19 + Vite + Tailwind 3 + Firebase. Tema claro fijo, `darkMode:'class'` conservado.
- **Detección de formato:** `useFormFactor.ts` → `mobile` (<768px), `tablet` (768–1200px **con** táctil), `desktop` (resto).
- **Patrón recomendado por el motor para este producto** (WMS industrial táctil): *Data-Dense Dashboard* — grises industriales + naranja de seguridad, tipografía técnica, máxima visibilidad de datos, **sin emojis como iconos**.

> El motor confirma la dirección actual (denso, operativo) pero marca tres deudas claras: **emojis como iconos**, **contraste/consistencia de tema**, y **falta de tipografía intencional**.

---

## 1. Hallazgo transversal nº1 — La app tiene DOS temas a la vez

Es lo primero que salta y afecta a los 3 viewports:

| Capa | Estilo real en código | Sensación |
|------|----------------------|-----------|
| Chrome (header, buscador, barras) | **Claro**: `bg-white`, fondo `bg-sky-50`, texto `slate-900` | Limpio, moderno |
| Celdas del grid (`ShelfGridCell`) | **Oscuro**: `bg-slate-900/95`, glows cian, sombras negras | Industrial-futurista |
| Barra de ocupación de escritorio (`ShelfGrid`) | **Oscura**: panel `bg-slate-900/90` | Isla oscura sobre fondo claro |

**Por qué importa:** el ojo percibe dos productos distintos pegados. En el contenido principal (el grid, que es el 80% de la pantalla) conviven tarjetas negras con cabeceras blancas. No es "malo", pero es lo que más frena la sensación de "siguiente nivel".

**Decisión a tomar (es de producto, conviene elegir):**
- **A) Comprometerse con claro** → celdas `bg-white`/`bg-slate-50`, bordes `slate-200`, acentos de color sólo en estados (URG, reproc…). Más legible con luz de nave y guantes; coherente con el chrome.
- **B) Comprometerse con oscuro** → header y buscador oscuros también. Más "centro de control", pero peor con reflejos de nave industrial.

> Recomendación: **opción A**. Para una nave con iluminación dura y tablets/kioskos, el tema claro de alto contraste es más legible y profesional, y elimina la disonancia de golpe.

---

## 2. Hallazgo transversal nº2 — Emojis como iconografía

Toda la botonera operativa usa emojis (`📦 UBICAR`, `📤 RETIRAR`, `🔄 MOVER`, `🔀 REUBICAR`, `🏭 ALMACÉN`, `🔔 AVISAR`, `📷`, `🚜`, `📡`, `👇`). La skill lo marca como **anti-patrón crítico de aspecto profesional** (`no-emoji-icons`), y además:

- Los emojis **renderizan distinto** en Android (kioskos), iOS y Windows (admin) → inconsistencia entre dispositivos.
- No heredan color del tema ni estados (hover/disabled).
- Tamaño impredecible vs. el texto.

**La buena noticia:** `lucide-react` **ya está instalado** (`package.json`) y apenas se usa en el flujo operativo. Sustituir emojis por iconos Lucide monocromos (`Package`, `PackageMinus`, `ArrowLeftRight`, `Shuffle`, `Warehouse`, `Bell`, `Camera`, `Forklift`) es un cambio de alto impacto visual y bajo riesgo.

> Mantener emojis sólo donde son *contenido* informal (toasts tipo "✓ Guardado") es aceptable; en **iconografía de acción**, no.

---

## 3. Hallazgo transversal nº3 — Tipografía sin intención

No se carga ninguna fuente: se usa la del sistema. Para un producto de datos densos:
- **Códigos / posiciones / OF:** ya usan `font-mono` (correcto, ayuda a leer referencias). Vale la pena fijar una mono real (ej. *JetBrains Mono* / *Fira Code*) para alinear dígitos.
- **UI / títulos:** una grotesca técnica (*Inter*, *Fira Sans*) con `tabular-nums` en contadores. Hoy ya se abusa de `font-black`; con una fuente bien elegida se puede bajar a `font-bold`/`font-semibold` y ganar elegancia sin perder fuerza.

---

## 4. Análisis por viewport

### 🖥️ 4.1 Ordenador de sobremesa (≥1200px, ratón)

**Lo que ya está bien**
- Bloques colapsados se convierten en **tiras verticales** con relleno de ocupación — uso inteligente del espacio horizontal.
- Scrollbars personalizados, hover con `-translate-y-0.5`, transiciones 200ms.
- Densidad alta apropiada para ratón.

**Oportunidades ("siguiente nivel")**
1. **El header de escritorio es demasiado pequeño.** Botones de acción a `text-[11px] px-2` y el `ℹ️`/`Salir` a `text-[10px]`. En un monitor grande sobra espacio; subir a tamaño cómodo mejora jerarquía sin saturar.
2. **Se desaprovecha el ancho.** Hoy es una sola columna de bloques que envuelve. En desktop cabe un **layout de 2 paneles**: navegación de estanterías/secciones fija a la izquierda (hoy se navega por tabs/selector) + grid a la derecha. Reduce clics para JEFE/ADMIN que saltan entre secciones.
3. **Dashboard para JEFE_SECCION / ADMIN.** El motor recomienda *Data-Dense Dashboard* con KPIs. Una franja superior con: % ocupación por sección, nº de urgencias activas, antigüedad media, cola de carretillero. Hoy esos datos existen en Firestore pero no se ven de un vistazo.
4. **Power-user con teclado.** No hay atajos. Para admin de escritorio: `U/R/M` para iniciar acción, `/` para foco en buscador, `Esc` para cancelar (ya hay doble-cancelar). Visibles en un tooltip.
5. **Estados de carga:** hoy un spinner cian centrado. En desktop, **skeletons** del grid dan sensación de velocidad y evitan el salto de layout.

### 📱 4.2 Tablet (768–1200px, táctil — kioskos/operarios)

Es el **dispositivo principal de producción** y, en general, el mejor resuelto.

**Lo que ya está bien**
- `OperativeActionBar` baja al pie con objetivos **≥48px** — operable con guantes. Excelente decisión.
- Header conmuta a tamaños táctiles (`min-h-11`).
- Barra de estado de acción con botones `min-h-[40px]` y `active:scale-95` (feedback táctil).
- Navegación por bloques con puntos cuando hay varios.

**Oportunidades**
1. **Modo kiosko = pantalla "siempre encendida".** En tablet fija conviene un estado de reposo/atención más claro: hoy en idle se ve buscador + grid. Un encabezado de sección más grande y un indicador de "lista para escanear" más visible reducen errores de operario nuevo.
2. **Los botones de acción inferiores usan `auto-fit minmax(5rem)`.** Con 6 acciones (carretillero/admin) en tablet estrecha pueden quedar en 2 filas algo apretadas. Revisar que UBICAR/RETIRAR (las dos más usadas) tengan siempre prioridad visual/tamaño.
3. **Confirmaciones críticas:** los modales (`fixed inset-0 ... items-end sm:items-center`) ya hacen *bottom-sheet* en móvil — bien. En tablet conviene que los botones primario/destructivo no queden al alcance accidental del pulgar al sostener.
4. **Feedback de escaneo:** el "📡 Esperando escáner…" es texto pequeño con pulse. En tablet a distancia, un banner de estado más grande (color + icono Lucide) comunica mejor el modo activo.

### 📲 4.3 Móvil (<768px)

**Lo que ya está bien**
- `font-size:16px` en inputs (evita zoom de iOS), `pb-safe`/`safe-area`, `100dvh`, `overscroll-behavior:none` — base PWA sólida.
- Navegación de bloque único con puntos + flechas; barra de acción al pie.
- Zonas en `grid-cols-2`; tarjetas con scroll horizontal contenido.

**Oportunidades**
1. **Densidad de la tarjeta oscura en pantalla pequeña.** La celda ocupada muestra header + lista de items + botón "Operar →" + badges. En móvil con varios artículos es mucha información negra apilada. Con tema claro (hallazgo nº1) y jerarquía tipográfica mejora la lectura a un golpe de vista.
2. **El buscador global es la función estrella en móvil** (un operario busca "¿dónde está X?"). Merece estar más arriba/accesible y con resultados más grandes. Hoy comparte espacio con el grid.
3. **Targets dentro de la tarjeta:** el botón "Operar →" y el cierre `×` del modal de celda (`text-2xl`) están bien; revisar que los puntos de navegación de bloque (`w-1.5 h-1.5`) sean cómodos — son objetivos diminutos; ampliar el área táctil (padding invisible) sin agrandar el punto.
4. **Pull-to-refresh** ya existe (`usePullToRefresh`) — verificar que da feedback visual claro.

---

## 5. Recomendaciones priorizadas

### 🟢 Quick wins (alto impacto / bajo riesgo)
1. **Sustituir emojis de acción por iconos Lucide** (ya instalado). — *visual + consistencia entre dispositivos.*
2. **Cargar una tipografía intencional** (Inter + JetBrains Mono) y bajar el abuso de `font-black`. — *elegancia inmediata.*
3. **Unificar tema del grid** (celdas claras) para eliminar la disonancia claro/oscuro. — *el cambio de mayor impacto percibido.*
4. **Skeletons** en lugar del spinner del grid. — *sensación de velocidad.*
5. **Banner de "modo escaneo activo"** más grande y con color. — *menos errores de operario.*

### 🟡 Proyectos medianos (más valor de utilidad)
6. **Layout 2 paneles en desktop** (navegación lateral de secciones + grid). — *menos clics para JEFE/ADMIN.*
7. **Franja de KPIs / mini-dashboard** para roles de gestión. — *visibilidad operativa.*
8. **Atajos de teclado** en escritorio. — *productividad power-user.*
9. **Heatmap de ocupación** por sección (color por % lleno) como vista resumen.

### 🔵 Diferenciadores (ya en vuestra propuesta Fase 3)
10. **Plano interactivo de la nave** (clic en zona → estantería).
11. **Pick-to-light / sugerencia de posición.**

---

## 6. Checklist de la skill aplicado a la app (estado actual)

| Ítem | Estado | Nota |
|------|--------|------|
| Sin emojis como iconos | ❌ | Botonera y estados usan emoji; migrar a Lucide |
| `cursor-pointer` en clicables | ✅ | Presente en celdas/headers |
| Transiciones 150–300ms | ✅ | `duration-200`, `active:scale-95` |
| Contraste texto ≥4.5:1 | ⚠️ | OK en chrome; revisar textos `slate-300/85` sobre cards oscuras |
| Focus states visibles | ⚠️ | Falta `focus-visible` explícito en muchos botones |
| `aria-label` en botones-icono | ⚠️ | Algunos sí (navegación bloques); el `ℹ️`/acciones, no |
| Targets táctiles ≥44px | ✅ | Barra inferior ≥48px, header táctil `min-h-11` |
| Responsive 375/768/1024/1440 | ✅ | 3 formatos bien diferenciados |
| Tipografía intencional | ❌ | Fuente de sistema; sin font pairing |
| `prefers-reduced-motion` | ❌ | No contemplado (hay `animate-pulse`, `animate-spin`) |
| Color no es el único indicador | ✅ | Estados llevan texto (URG, VT, REPROC…) |

---

## 7. Cómo seguir usando la skill

Para cada pantalla concreta que se rediseñe:

```bash
# Sistema de diseño completo para una vista
python .claude/skills/ui-ux-pro-max/scripts/search.py "warehouse operator kiosk touch" --design-system -f markdown

# Buenas prácticas UX puntuales
python .claude/skills/ui-ux-pro-max/scripts/search.py "loading skeleton accessibility focus" --domain ux

# Guía específica del stack
python .claude/skills/ui-ux-pro-max/scripts/search.py "list grid form responsive" --stack react
```

> Siguiente paso sugerido: empezar por los **Quick wins 1–3** (iconos, tipografía, tema del grid). Son los que más cambian la percepción de "siguiente nivel" con el menor riesgo de tocar la lógica operativa.
