import { entidadIdPar, entidadIdParPrefix } from './entidad-id';

describe('entidadIdPar', () => {
  it('serializa la PK compuesta como vinculacionId:puestoId:centroCostoId', () => {
    expect(entidadIdPar(10, 'p-soldador', 'c-ypf')).toBe('10:p-soldador:c-ypf');
  });

  it('dos pares distintos de la misma vinculación dan claves distintas', () => {
    expect(entidadIdPar(10, 'p-soldador', 'c-ypf')).not.toBe(
      entidadIdPar(10, 'p-amolador', 'c-ypf'),
    );
  });
});

describe('entidadIdParPrefix', () => {
  it('es el prefijo con el que arranca entidadIdPar para la misma vinculación', () => {
    const clave = entidadIdPar(10, 'p-soldador', 'c-ypf');
    expect(clave.startsWith(entidadIdParPrefix(10))).toBe(true);
  });

  it('no matchea el prefijo de otra vinculación', () => {
    // "1:" no tiene que matchear "10:...": el separador ":" después del
    // número entero es lo que evita el falso positivo.
    const clave = entidadIdPar(10, 'p-soldador', 'c-ypf');
    expect(clave.startsWith(entidadIdParPrefix(1))).toBe(false);
  });
});
