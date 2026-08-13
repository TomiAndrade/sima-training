import { evaluarReintentos, mensajeReintentos } from './reintentos';

const AHORA = new Date('2026-08-13T12:00:00Z');

// Una sesión rendida `minutos` antes de AHORA.
const haceMinutos = (minutos: number, aprobada = false) => ({
  finalizadaEn: new Date(AHORA.getTime() - minutos * 60_000),
  aprobada,
});

const evaluar = (
  sesiones: { finalizadaEn: Date; aprobada: boolean }[],
  maxIntentos: number | null = null,
  esperaMinutos: number | null = null,
) => evaluarReintentos({ sesiones, maxIntentos, esperaMinutos, ahora: AHORA });

describe('evaluarReintentos', () => {
  it('sin parámetros declarados nunca bloquea: es el comportamiento de siempre', () => {
    const res = evaluar([haceMinutos(1), haceMinutos(2), haceMinutos(3)]);

    expect(res).toMatchObject({
      puedeRendir: true,
      motivo: 'OK',
      intentosUsados: 3,
      // null = sin tope, distinto de 0 = se acabaron.
      intentosRestantes: null,
      proximoIntentoEn: null,
    });
  });

  it('sin ninguna sesión previa puede rendir aunque haya espera declarada', () => {
    expect(evaluar([], 2, 60)).toMatchObject({
      puedeRendir: true,
      intentosUsados: 0,
      intentosRestantes: 2,
    });
  });

  it('descuenta los intentos usados', () => {
    expect(evaluar([haceMinutos(500)], 3)).toMatchObject({
      puedeRendir: true,
      intentosUsados: 1,
      intentosRestantes: 2,
    });
  });

  it('bloquea al agotar el tope', () => {
    const res = evaluar([haceMinutos(500), haceMinutos(400)], 2);

    expect(res).toMatchObject({
      puedeRendir: false,
      motivo: 'SIN_INTENTOS',
      intentosUsados: 2,
      intentosRestantes: 0,
      // Esperar no lo destraba, así que no se ofrece una fecha.
      proximoIntentoEn: null,
    });
  });

  it('el tope gana sobre la espera: sin intentos no se promete una fecha', () => {
    // Recién rendida (dentro de la ventana de espera) Y sin intentos: tiene que
    // decir SIN_INTENTOS, que es lo terminal.
    expect(evaluar([haceMinutos(1), haceMinutos(2)], 2, 60)).toMatchObject({
      motivo: 'SIN_INTENTOS',
      proximoIntentoEn: null,
    });
  });

  it('bloquea durante la espera y dice desde cuándo', () => {
    const res = evaluar([haceMinutos(20)], null, 60);

    expect(res).toMatchObject({
      puedeRendir: false,
      motivo: 'EN_ESPERA',
      intentosUsados: 1,
    });
    // 60 minutos después de la última: faltan 40.
    expect(res.proximoIntentoEn).toEqual(
      new Date(AHORA.getTime() + 40 * 60_000),
    );
  });

  it('habilita cuando la espera ya venció', () => {
    expect(evaluar([haceMinutos(90)], null, 60)).toMatchObject({
      puedeRendir: true,
      motivo: 'OK',
      proximoIntentoEn: null,
    });
  });

  it('la espera se mide contra la ÚLTIMA sesión, aunque venga desordenada', () => {
    // La más reciente es la de hace 5 minutos, no la primera del array.
    const res = evaluar(
      [haceMinutos(300), haceMinutos(5), haceMinutos(120)],
      null,
      60,
    );

    expect(res.motivo).toBe('EN_ESPERA');
    expect(res.proximoIntentoEn).toEqual(
      new Date(AHORA.getTime() + 55 * 60_000),
    );
  });

  it('aprobar resetea el contador: sólo cuentan las sesiones posteriores', () => {
    // 3 intentos fallidos, después aprobó, después 1 fallido más (la vigencia
    // venció y volvió a rendir). Con tope 3 tiene que poder seguir rindiendo.
    const res = evaluar(
      [
        haceMinutos(500),
        haceMinutos(400),
        haceMinutos(300),
        haceMinutos(200, true),
        haceMinutos(100),
      ],
      3,
    );

    expect(res).toMatchObject({
      puedeRendir: true,
      intentosUsados: 1,
      intentosRestantes: 2,
    });
  });

  it('la espera también ignora lo anterior a la aprobación', () => {
    // Lo más reciente es la aprobación misma: no hay ningún intento posterior,
    // así que no hay contra qué medir la espera.
    expect(
      evaluar([haceMinutos(500), haceMinutos(5, true)], 2, 60),
    ).toMatchObject({
      puedeRendir: true,
      intentosUsados: 0,
      intentosRestantes: 2,
    });
  });

  it('cuenta contra la ÚLTIMA aprobación cuando hay varias', () => {
    const res = evaluar(
      [
        haceMinutos(900, true),
        haceMinutos(800),
        haceMinutos(700, true),
        haceMinutos(600),
        haceMinutos(500),
      ],
      3,
    );

    expect(res.intentosUsados).toBe(2);
  });
});

describe('mensajeReintentos', () => {
  it('explica el tope agotado sin prometer una fecha', () => {
    const mensaje = mensajeReintentos(
      evaluar([haceMinutos(500), haceMinutos(400)], 2),
    );

    expect(mensaje).toContain('2 intentos');
    expect(mensaje).not.toContain('a partir del');
  });

  it('dice la fecha y hora exactas cuando es espera', () => {
    const mensaje = mensajeReintentos(evaluar([haceMinutos(20)], null, 60));

    expect(mensaje).toContain('a partir del');
    // dd/mm/aaaa a las HH:MM
    expect(mensaje).toMatch(/\d{2}\/\d{2}\/\d{4} a las \d{2}:\d{2}/);
  });
});
