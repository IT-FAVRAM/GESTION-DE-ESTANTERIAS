import { describe, expect, it } from 'vitest';
import { resolveCapabilities } from '../domain/auth/authCapabilities';

describe('resolveCapabilities', () => {
  it('permite operar a jefe solo en su estantería asignada', () => {
    const caps = resolveCapabilities('JEFE_SECCION', 'email', 'MEC');
    expect(caps.canOperateShelf).toBe(true);
    expect(caps.canAccessShelf('MEC')).toBe(true);
    expect(caps.canAccessShelf('PLE')).toBe(false);
  });

  it('calidad solo accede a CAL', () => {
    const caps = resolveCapabilities('CALIDAD', 'email', 'CAL');
    expect(caps.canOperateShelf).toBe(true);
    expect(caps.canAccessShelf('CAL')).toBe(true);
    expect(caps.canAccessShelf('MEC')).toBe(false);
  });

  it('operario solo su estantería', () => {
    const caps = resolveCapabilities('OPERARIO', 'guest', 'PLE');
    expect(caps.canAccessShelf('PLE')).toBe(true);
    expect(caps.canAccessShelf('MEC')).toBe(false);
  });

  it('carretillero navega todas las estanterías', () => {
    const caps = resolveCapabilities('CARRETILLERO', 'guest', null);
    expect(caps.canBrowseAllShelves).toBe(true);
    expect(caps.canAccessShelf('PRE')).toBe(true);
    expect(caps.canOperateShelf).toBe(true);
  });
});


