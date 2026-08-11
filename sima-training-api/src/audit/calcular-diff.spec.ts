import { calcularDiff, hayCambios } from './calcular-diff';

describe('calcularDiff', () => {
  it('alta: antes null, todos los campos de despues entran con antes: null', () => {
    const diff = calcularDiff(null, { nombre: 'Juan', activo: true });

    expect(diff).toEqual({
      nombre: { antes: null, despues: 'Juan' },
      activo: { antes: null, despues: true },
    });
  });

  it('baja: despues null, todos los campos de antes entran con despues: null', () => {
    const diff = calcularDiff({ nombre: 'Juan', activo: true }, null);

    expect(diff).toEqual({
      nombre: { antes: 'Juan', despues: null },
      activo: { antes: true, despues: null },
    });
  });

  it('update: sólo entra el campo que cambió', () => {
    const diff = calcularDiff(
      { nombre: 'Juan', activo: true },
      { nombre: 'Juan', activo: false },
    );

    expect(diff).toEqual({ activo: { antes: true, despues: false } });
  });

  it('update sin cambios: diff vacío', () => {
    const diff = calcularDiff(
      { nombre: 'Juan', activo: true },
      { nombre: 'Juan', activo: true },
    );

    expect(diff).toEqual({});
  });

  it('camposIgnorados se descarta siempre, en alta y en update', () => {
    const alta = calcularDiff(null, { nombre: 'Juan', createdAt: new Date() }, [
      'createdAt',
    ]);
    expect(alta).toEqual({ nombre: { antes: null, despues: 'Juan' } });

    const update = calcularDiff(
      { nombre: 'Juan', updatedAt: new Date(2025, 0, 1) },
      { nombre: 'Ana', updatedAt: new Date(2025, 0, 2) },
      ['updatedAt'],
    );
    expect(update).toEqual({ nombre: { antes: 'Juan', despues: 'Ana' } });
  });

  it('dos Date que representan el mismo instante NO son un cambio', () => {
    // Misma hora, dos instancias distintas — como pasa siempre que se lee la
    // misma columna dos veces de la base.
    const antes = new Date('2026-01-01T00:00:00.000Z');
    const despues = new Date('2026-01-01T00:00:00.000Z');

    expect(calcularDiff({ fecha: antes }, { fecha: despues })).toEqual({});
  });

  it('dos Date con distinto instante SÍ son un cambio', () => {
    const antes = new Date('2026-01-01T00:00:00.000Z');
    const despues = new Date('2026-01-02T00:00:00.000Z');

    expect(calcularDiff({ fecha: antes }, { fecha: despues })).toEqual({
      fecha: { antes, despues },
    });
  });

  it('null y undefined se tratan como el mismo valor: no es un cambio', () => {
    expect(calcularDiff({ email: undefined }, { email: null })).toEqual({});
    expect(calcularDiff({ email: null }, { email: undefined })).toEqual({});
  });
});

describe('hayCambios', () => {
  it('true si el diff tiene al menos un campo', () => {
    expect(hayCambios({ nombre: { antes: 'a', despues: 'b' } })).toBe(true);
  });

  it('false si el diff está vacío', () => {
    expect(hayCambios({})).toBe(false);
  });
});
