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

  it('alta sin valor en un campo no genera entrada — ni siquiera null → null', () => {
    // deletedAt nace en null: antes (no hay fila) y el valor real son el
    // mismo "no hay nada", así que no es una entrada de diff.
    const diff = calcularDiff(null, { nombre: 'Juan', deletedAt: null });
    expect(diff).toEqual({ nombre: { antes: null, despues: 'Juan' } });
  });

  describe('camposRedactados', () => {
    it('alta: un campo redactado con valor real entra como { redactado: true }, sin el valor', () => {
      const diff = calcularDiff(
        null,
        { nombre: 'Juan', dni: '30111222' },
        [],
        ['dni'],
      );
      expect(diff).toEqual({
        nombre: { antes: null, despues: 'Juan' },
        dni: { redactado: true },
      });
    });

    it('alta sin valor en el campo redactado: no genera ninguna entrada', () => {
      // Sin email no hay nada que redactar — mismo criterio que cualquier
      // otro campo que nace en null (ver el test de arriba).
      const diff = calcularDiff(null, { nombre: 'Juan', email: null }, [], [
        'email',
      ]);
      expect(diff).toEqual({ nombre: { antes: null, despues: 'Juan' } });
    });

    it('baja: un campo redactado que tenía valor entra como { redactado: true }', () => {
      const diff = calcularDiff(
        { nombre: 'Juan', dni: '30111222' },
        null,
        [],
        ['dni'],
      );
      expect(diff).toEqual({
        nombre: { antes: 'Juan', despues: null },
        dni: { redactado: true },
      });
    });

    it('update: campo redactado que cambió entra como { redactado: true }, nunca los valores', () => {
      const diff = calcularDiff(
        { dni: '30111222' },
        { dni: '30999888' },
        [],
        ['dni'],
      );
      expect(diff).toEqual({ dni: { redactado: true } });
    });

    it('update: campo redactado que NO cambió no genera ninguna entrada', () => {
      const diff = calcularDiff(
        { nombre: 'Juan', dni: '30111222' },
        { nombre: 'Ana', dni: '30111222' },
        [],
        ['dni'],
      );
      expect(diff).toEqual({ nombre: { antes: 'Juan', despues: 'Ana' } });
    });

    it('un campo puede estar ignorado Y redactado a la vez: gana ignorado (no entra)', () => {
      const diff = calcularDiff(
        { dni: '30111222' },
        { dni: '30999888' },
        ['dni'],
        ['dni'],
      );
      expect(diff).toEqual({});
    });
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
