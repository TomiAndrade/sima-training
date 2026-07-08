import {
  clasificar,
  dice,
  normalizar,
  toRef,
  trigramas,
  UMBRAL_PARECIDA,
} from './similitud';

describe('similitud', () => {
  describe('normalizar', () => {
    it('pasa a minúsculas, quita acentos y puntuación, colapsa espacios', () => {
      expect(normalizar('  ¿El CASCO es Obligatorio?  ')).toBe(
        'el casco es obligatorio',
      );
      expect(normalizar('Señalización de área crítica')).toBe(
        'senalizacion de area critica',
      );
    });

    it('dos textos que solo difieren en acentos/mayúsculas normalizan igual', () => {
      expect(normalizar('Está prohibido')).toBe(normalizar('esta PROHIBIDO'));
    });
  });

  describe('dice', () => {
    it('textos idénticos → 1', () => {
      const a = trigramas(normalizar('el uso del casco es obligatorio'));
      const b = trigramas(normalizar('el uso del casco es obligatorio'));
      expect(dice(a, b)).toBe(1);
    });

    it('textos totalmente distintos → bajo', () => {
      const a = trigramas(normalizar('el uso del casco es obligatorio'));
      const b = trigramas(normalizar('reunion de seguridad los lunes'));
      expect(dice(a, b)).toBeLessThan(0.3);
    });
  });

  describe('clasificar', () => {
    const banco = [
      toRef('El uso del casco es obligatorio en todas las áreas', 'p1'),
      toRef('Se debe reportar todo incidente al supervisor', 'p2'),
    ];

    it('detecta duplicada exacta (ignorando acentos/mayúsculas)', () => {
      const r = clasificar(
        'el uso del CASCO es obligatorio en todas las areas',
        banco,
      );
      expect(r.estado).toBe('duplicada');
      expect(r.similar?.preguntaId).toBe('p1');
      expect(r.similar?.score).toBe(1);
    });

    it('detecta parecida (misma idea, algunas palabras cambiadas)', () => {
      const r = clasificar(
        'El uso del casco es obligatorio en todas las zonas',
        banco,
      );
      expect(r.estado).toBe('parecida');
      expect(r.similar?.preguntaId).toBe('p1');
      expect(r.similar?.score).toBeGreaterThanOrEqual(UMBRAL_PARECIDA);
      expect(r.similar?.score).toBeLessThan(1);
    });

    it('marca como nueva una pregunta sin relación con el banco', () => {
      const r = clasificar('¿Cada cuánto se recarga un matafuego?', banco);
      expect(r.estado).toBe('nueva');
      expect(r.similar).toBeUndefined();
    });

    it('texto vacío → nueva', () => {
      expect(clasificar('   ', banco).estado).toBe('nueva');
    });
  });
});
