import { calcularVencimiento, sumarMeses } from './vigencia';

describe('sumarMeses', () => {
  it('caso normal, sin acercarse a ningún borde de mes', () => {
    expect(sumarMeses(new Date(Date.UTC(2025, 5, 15)), 2)).toEqual(
      new Date(Date.UTC(2025, 7, 15)), // 15/06/2025 + 2 = 15/08/2025
    );
  });

  it('31/01 + 1 mes clampea a 28/02 (no desborda a marzo)', () => {
    // Date.setMonth() a secas convertiría esto en 02 o 03/03: "31 de
    // febrero" no existe y JS lo corre al mes siguiente.
    expect(sumarMeses(new Date(Date.UTC(2025, 0, 31)), 1)).toEqual(
      new Date(Date.UTC(2025, 1, 28)),
    );
  });

  it('31/03 + 1 mes clampea a 30/04', () => {
    expect(sumarMeses(new Date(Date.UTC(2025, 2, 31)), 1)).toEqual(
      new Date(Date.UTC(2025, 3, 30)),
    );
  });

  it('30/11 + 3 meses cruza a febrero del año siguiente y clampea', () => {
    expect(sumarMeses(new Date(Date.UTC(2025, 10, 30)), 3)).toEqual(
      new Date(Date.UTC(2026, 1, 28)), // 2026 no es bisiesto
    );
  });

  it('año bisiesto: 29/02/2024 + 12 meses clampea a 28/02/2025', () => {
    // El día de origen (29) no existe en el mes destino: 2025 no es bisiesto.
    expect(sumarMeses(new Date(Date.UTC(2024, 1, 29)), 12)).toEqual(
      new Date(Date.UTC(2025, 1, 28)),
    );
  });

  it('cruce de año sin clamp: 15/11 + 3 meses', () => {
    expect(sumarMeses(new Date(Date.UTC(2025, 10, 15)), 3)).toEqual(
      new Date(Date.UTC(2026, 1, 15)),
    );
  });
});

describe('calcularVencimiento', () => {
  // Aprobación el 01/01/2025 con vigencia de 12 meses: día 1, así que
  // sumarMeses no clampea nada acá — el vencimiento conocido de antemano es
  // 01/01/2026, sin depender de que sumarMeses esté bien para poder afirmarlo.
  const aprobadaEn = new Date(Date.UTC(2025, 0, 1));
  const vigenciaMeses = 12;
  const venceEl = new Date(Date.UTC(2026, 0, 1));

  it('sin aprobación previa: SIN_APROBAR y sin fecha de vencimiento', () => {
    expect(
      calcularVencimiento(null, vigenciaMeses, new Date(Date.UTC(2025, 5, 1))),
    ).toEqual({ estado: 'SIN_APROBAR', venceEl: null });
  });

  it('vigenciaMeses null: el módulo no vence nunca', () => {
    expect(
      calcularVencimiento(aprobadaEn, null, new Date(Date.UTC(2025, 5, 1))),
    ).toEqual({ estado: 'VIGENTE', venceEl: null });
  });

  it('vigenciaMeses 0: mismo caso que null, no vence nunca', () => {
    expect(
      calcularVencimiento(aprobadaEn, 0, new Date(Date.UTC(2025, 5, 1))),
    ).toEqual({ estado: 'VIGENTE', venceEl: null });
  });

  it('VIGENTE con margen holgado', () => {
    const ahora = new Date(Date.UTC(2025, 5, 1)); // faltan ~7 meses
    expect(calcularVencimiento(aprobadaEn, vigenciaMeses, ahora)).toEqual({
      estado: 'VIGENTE',
      venceEl,
    });
  });

  it('todavía VIGENTE un día antes del borde de POR_VENCER', () => {
    const ahora = new Date(venceEl.getTime() - 31 * 24 * 60 * 60 * 1000);
    expect(calcularVencimiento(aprobadaEn, vigenciaMeses, ahora)).toEqual({
      estado: 'VIGENTE',
      venceEl,
    });
  });

  it('POR_VENCER en el borde exacto: faltan EXACTAMENTE 30 días', () => {
    // <= y no <: si esto se rompe, el aviso de 30 días llega un día tarde.
    const ahora = new Date(venceEl.getTime() - 30 * 24 * 60 * 60 * 1000);
    expect(calcularVencimiento(aprobadaEn, vigenciaMeses, ahora)).toEqual({
      estado: 'POR_VENCER',
      venceEl,
    });
  });

  it('VENCIDO en el borde exacto: ahora === venceEl', () => {
    // >= y no >: el instante del vencimiento ya cuenta como vencido, no como
    // el último instante vigente.
    expect(calcularVencimiento(aprobadaEn, vigenciaMeses, venceEl)).toEqual({
      estado: 'VENCIDO',
      venceEl,
    });
  });

  it('vencido hace rato', () => {
    const ahora = new Date(Date.UTC(2027, 0, 1));
    expect(calcularVencimiento(aprobadaEn, vigenciaMeses, ahora)).toEqual({
      estado: 'VENCIDO',
      venceEl,
    });
  });
});
