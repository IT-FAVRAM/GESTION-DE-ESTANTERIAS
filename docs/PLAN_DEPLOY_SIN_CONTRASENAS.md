# Plan: Deploy SIN Cambios de Contraseñas

**Fecha:** 2026-07-16  
**Objetivo:** Deploy de todos los cambios recientes EXCEPTO el commit de contraseñas (`3b69fab`)

## Resumen

- 25 commits por delante de origin/main
- Commit a EXCLUIR: `3b69fab` (feat(passwords): actualizar contraseñas usuarios julio 2026)
- Commits a INCLUIR: 24 commits restantes

## Commits a Cherry-Pick (en orden cronológico)

| # | Hash | Descripción |
|---|------|-------------|
| 1 | `b96ac7d` | refactor(hooks,schema): limpieza y actualizaciones de tipos |
| 2 | `7e04d3e` | ui(chapero): soporte albarán en modal ubicación |
| 3 | `2d5eda8` | backend: agregar campo albarán en chaperoOperate |
| 4 | `d1e30fa` | ui: ajustes en componentes admin, kiosk, operativo |
| 5 | `7ba6519` | docs+feat: agregar parciales.ts y actualizar config |
| 6 | `ac4be7c` | docs: agregar estudios UX, manuales kiosko y configuración dispositivos |
| 7 | `608bc89` | feat(ux+operaciones): 4 mejoras clave en kioskos, ocupación e interfaz carretillero |
| 8 | `eee9be5` | feat(recepciones)+fix(lead-time): nuevo rol RECEPCIONES y arreglo Análisis Lead Time |
| 9 | `3fd743a` | fix(kiosk): reintentar lectura de config tras refrescar token en arranque en frío |
| 10 | `3e771a5` | fix(reubicar): reasignar shelfCodes al mover entre secciones |
| 11 | `e9c71b5` | perf+fix(findArticleGlobal): 1 query en vez de 15 y sin duplicados en silencio |
| 12 | `e86b566` | fix(offline): no descartar retiradas de ubicación fallidas como éxito |
| 13 | `440b2a5` | feat(admin): pestaña "Duplicados" para detectar y limpiar fantasmas |
| 14 | `dcf9a4a` | feat(admin): aviso "ya ubicado" airtight en el navegador manual del admin |
| 15 | `140aa34` | fix(admin): añadir lanzador "Duplicados" en el home de admin |
| 16 | `bd69e4b` | feat(shelves): renombrar CRP, añadir carro EAM e historial diario para Jefe Soldadura |
| 17 | `cba0fbe` | feat(ui): prefill "OF26-" en entrada manual de piezas |
| 18 | `af1edc6` | feat(notificaciones): avisar a A.AGUADO por cada ubicación en Soldadura |
| 19 | `2486fac` | feat(retirar): buscador en listas de Retirar + cross-sección para V. Torbellino |
| 20 | `cc54c6b` | feat(recepciones): habilitar acceso completo a estanterias en movil + refactor RecepcionesView |
| 21 | `426ce27` | feat(passwords): actualizar contraseñas usuarios julio 2026 + Excel de referencia |
| 22 | `36efd95` | feat(ubicaciones): permitir editar artículo y OF en ubicaciones para carretilleros, admins y superadmin |
| 23 | `a0f51f1` | feat(escaneo): añadir escaneo pasivo en kiosko y atajos de pistola en carretillero |

## Comandos a Ejecutar

```bash
# 1. Asegúrate de estar en main
git checkout main

# 2. Cherry-pick los commits en orden (excluyendo 3b69fab)
git cherry-pick b96ac7d
git cherry-pick 7e04d3e
git cherry-pick 2d5eda8
git cherry-pick d1e30fa
git cherry-pick 7ba6519
git cherry-pick ac4be7c
git cherry-pick 608bc89
git cherry-pick eee9be5
git cherry-pick 3fd743a
git cherry-pick 3e771a5
git cherry-pick e9c71b5
git cherry-pick e86b566
git cherry-pick 440b2a5
git cherry-pick dcf9a4a
git cherry-pick 140aa34
git cherry-pick bd69e4b
git cherry-pick cba0fbe
git cherry-pick af1edc6
git cherry-pick 2486fac
git cherry-pick cc54c6b
git cherry-pick 36efd95
git cherry-pick a0f51f1

# 3. Push al remote
git push origin main
```

## Notas Importantes

- **Commit excluido:** `3b69fab` contiene cambios de contraseñas que NO se deployarán
- **Dependencias:** Los 24 commits restantes NO dependen del commit de contraseñas
- **Conflictos:** Si hay conflictos, ejecutar `git cherry-pick --abort` y avisar para resolver
- **Rollback:** Si algo falla, puedes volver al estado anterior con `git reset --hard origin/main`

## Archivos que NO se deployarán

- `USUARIOS_FAVRAM.xlsx`
- `scripts/update_passwords_julio2026.ts`
- `scripts/generate_users_excel.js`
- `scripts/generate_users_excel.ts`
- Cambios en `scripts/setup-users.ts`
- Cambios en `package.json` / `package-lock.json` (relacionados con dependencias de scripts)

## Commits Posteriores (ya incluidos)

- `36efd95` - Editar artículo y OF en ubicaciones
- `a0f51f1` - Escaneo pasivo en kiosko y atajos de pistola
