import { describe, expect, it } from 'vitest';
import { resolveCapabilities } from '../domain/auth/authCapabilities';

describe('resolveCapabilities', () => {
  it('permite operar a jefe solo en su sección asignada', () => {
    const caps = resolveCapabilities('JEFE_SECCION', 'email', 'PRE');
    expect(caps.canOperateShelf).toBe(true);
    expect(caps.canAccessShelf('PRE')).toBe(true);
    expect(caps.canAccessShelf('PLE')).toBe(false);
  });

  it('calidad solo accede a CAL', () => {
    const caps = resolveCapabilities('CALIDAD', 'email', 'CAL');
    expect(caps.canOperateShelf).toBe(true);
    expect(caps.canAccessShelf('CAL')).toBe(true);
    expect(caps.canAccessShelf('PRE')).toBe(false);
  });

  it('operario: la capa de capacidades no restringe estanterías (lo hace el kiosko/dispositivo y el backend)', () => {
    // Diseño actual (desde 3e10dbf): el kiosko define qué estanterías ofrece al
    // operario (ShelfSelector); el backend valida la operación. canAccessShelf
    // devuelve true para no bloquear kioskos multi-estantería.
    const caps = resolveCapabilities('OPERARIO', 'guest', 'PLE');
    expect(caps.canAccessShelf('PLE')).toBe(true);
    expect(caps.canAccessShelf('PRE')).toBe(true);
    expect(caps.canBrowseAllShelves).toBe(false);
  });

  it('carretillero navega todas las estanterías', () => {
    const caps = resolveCapabilities('CARRETILLERO', 'guest', null);
    expect(caps.canBrowseAllShelves).toBe(true);
    expect(caps.canAccessShelf('PRE')).toBe(true);
    expect(caps.canOperateShelf).toBe(true);
  });
});


