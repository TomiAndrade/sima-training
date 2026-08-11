import { calcularVeredicto, AsignacionParaVeredicto } from './veredicto';
import { EstadoVigencia } from './vigencia';

describe('calcularVeredicto', () => {
  const asignacion = (
    id: string,
    estado: EstadoVigencia,
    revocadaAt: Date | null = null,
    moduloNombre = `Módulo ${id}`,
  ): AsignacionParaVeredicto => ({
    id,
    moduloNombre,
    revocadaAt,
    vencimiento: { estado },
  });

  it('array vacío: SIN_OBLIGACIONES', () => {
    expect(calcularVeredicto([])).toEqual({
      estado: 'SIN_OBLIGACIONES',
      asignacion: null,
    });
  });

  it('todas VIGENTE: EN_REGLA', () => {
    const asignaciones = [
      asignacion('1', 'VIGENTE'),
      asignacion('2', 'VIGENTE'),
    ];
    expect(calcularVeredicto(asignaciones)).toEqual({
      estado: 'EN_REGLA',
      asignacion: null,
    });
  });

  it('una VENCIDO entre varias VIGENTE: NO_HABILITADO, apunta a esa', () => {
    const vencida = asignacion('2', 'VENCIDO');
    const asignaciones = [
      asignacion('1', 'VIGENTE'),
      vencida,
      asignacion('3', 'VIGENTE'),
    ];
    expect(calcularVeredicto(asignaciones)).toEqual({
      estado: 'NO_HABILITADO',
      asignacion: { id: '2', moduloNombre: 'Módulo 2' },
    });
  });

  it('una SIN_APROBAR y ninguna VENCIDO: PENDIENTE', () => {
    const sinAprobar = asignacion('2', 'SIN_APROBAR');
    const asignaciones = [asignacion('1', 'VIGENTE'), sinAprobar];
    expect(calcularVeredicto(asignaciones)).toEqual({
      estado: 'PENDIENTE',
      asignacion: { id: '2', moduloNombre: 'Módulo 2' },
    });
  });

  it('una POR_VENCER, sin VENCIDO ni SIN_APROBAR: POR_VENCER', () => {
    const porVencer = asignacion('2', 'POR_VENCER');
    const asignaciones = [asignacion('1', 'VIGENTE'), porVencer];
    expect(calcularVeredicto(asignaciones)).toEqual({
      estado: 'POR_VENCER',
      asignacion: { id: '2', moduloNombre: 'Módulo 2' },
    });
  });

  it('VENCIDO y SIN_APROBAR a la vez: gana NO_HABILITADO (jerarquía de gravedad)', () => {
    const sinAprobar = asignacion('1', 'SIN_APROBAR');
    const vencida = asignacion('2', 'VENCIDO');
    const asignaciones = [sinAprobar, vencida];
    expect(calcularVeredicto(asignaciones)).toEqual({
      estado: 'NO_HABILITADO',
      asignacion: { id: '2', moduloNombre: 'Módulo 2' },
    });
  });

  it('una VENCIDO pero REVOCADA + el resto VIGENTE: EN_REGLA (la revocada no cuenta)', () => {
    const vencidaRevocada = asignacion('1', 'VENCIDO', new Date());
    const asignaciones = [vencidaRevocada, asignacion('2', 'VIGENTE')];
    expect(calcularVeredicto(asignaciones)).toEqual({
      estado: 'EN_REGLA',
      asignacion: null,
    });
  });

  it('todas revocadas: SIN_OBLIGACIONES (equivalente a array vacío tras filtrar)', () => {
    const asignaciones = [
      asignacion('1', 'VENCIDO', new Date()),
      asignacion('2', 'VIGENTE', new Date()),
    ];
    expect(calcularVeredicto(asignaciones)).toEqual({
      estado: 'SIN_OBLIGACIONES',
      asignacion: null,
    });
  });

  it('dos VENCIDO: el veredicto apunta a la PRIMERA del array', () => {
    const primera = asignacion('1', 'VENCIDO');
    const segunda = asignacion('2', 'VENCIDO');
    expect(calcularVeredicto([primera, segunda])).toEqual({
      estado: 'NO_HABILITADO',
      asignacion: { id: '1', moduloNombre: 'Módulo 1' },
    });
  });
});
