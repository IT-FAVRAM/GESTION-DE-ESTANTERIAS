# Contrato técnico: rol CALIDAD — WMS v3

**Fecha de cierre:** 2026-04-28  
**Estado:** ACTIVO

---

## Dos experiencias diferenciadas

### CALIDAD autenticada (email + contraseña)

- Accede vía formulario email/contraseña en UnifiedLogin
- `authMethod = 'email'`
- Vista: `CalidadView` con acceso completo de su sección
- Estanterías visibles: **solo CAL**
- Puede operar: ubicar, retirar, mover, avisar en CAL
- **Puede ver importes de reprocesos** (banner total + detalle por celda)
- Puede editar items de reprocesos

### CALIDAD visual / kiosko (acceso rápido o dispositivo asignado)

- Accede vía acceso rápido o dispositivo físico asignado a CAL
- `authMethod = 'guest'`
- Vista: `CalidadView` restringida
- Estanterías visibles: **solo CAL**
- Puede operar: ubicar, retirar, mover, avisar en CAL (según subcapacidad)
- **No puede ver importes de reprocesos**
- No puede editar importes de reprocesos

---

## Reglas de acceso a estanterías

1. CALIDAD **nunca** puede ver ni navegar estanterías distintas de CAL.
2. No existe pestaña "ESTANTERÍAS" ni selector global de estanterías para CALIDAD.
3. Si se intenta acceder a otra estantería por URL o navegación manual, la app bloquea el acceso.
4. La validación ocurre tanto en UI (no se muestra el selector) como en `useShelf` (devuelve vacío si la estantería no está permitida).

---

## Regla de visibilidad de importes de reprocesos

```
canViewReprocessCosts = (role === 'CALIDAD' && authMethod === 'email')
                        || role === 'ADMIN'
                        || role === 'SUPERADMIN'
```

- El banner "Total Reprocesos" solo se renderiza si `canViewReprocessCosts === true`.
- La línea `{quantity} ud · {unitCost} €/ud` en cada celda solo se renderiza si `showReprocessCosts === true`.
- El badge `€` en ShelfGridCell solo aparece si `showReprocessCosts === true`.

---

## Decisión sobre kiosko físico de CAL

El kiosko físico asignado a CAL se trata como **CALIDAD visual** (`authMethod = 'guest'`):
- Puede operar (ubicar, retirar, mover, avisar)
- No puede ver importes

Si en el futuro se necesita separar `canEditReprocesses` de `canViewReprocessCosts`, se añade la capacidad sin romper el contrato actual.

---

## Componentes

| Componente | Propósito |
|---|---|
| `CalidadView` | Vista operativa de CALIDAD (fija en CAL) |
| `ShelfGrid` | Grid de ubicaciones con prop `showReprocessCosts` |
| `ShelfGridCell` | Celda individual con prop `showReprocessCosts` |
| `ReprocesosEditor` | Editor de items de reproceso (solo si `canEditReprocesses`) |

---

## Criterio de aceptación

- [ ] CALIDAD autenticada por email ve el banner de importes y el detalle por celda
- [ ] CALIDAD en acceso rápido NO ve importes
- [ ] CALIDAD nunca puede abrir otras estanterías (ni por UI ni navegación manual)
- [ ] El kiosko de CAL no muestra importes
