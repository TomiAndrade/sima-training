import {
  UMBRAL_APROBACION_DEFAULT,
  calcularResultado,
  esCorrecta,
} from './corregir';

describe('esCorrecta', () => {
  it('compara por igualdad exacta de string (V/F y opción múltiple)', () => {
    expect(esCorrecta('Verdadero', 'Verdadero')).toBe(true);
    expect(esCorrecta('Verdadero', 'Falso')).toBe(false);
    expect(esCorrecta('Usar arnés', 'Usar arnés')).toBe(true);
    expect(esCorrecta('Usar arnés', 'Usar casco')).toBe(false);
  });

  it('en OPCIONES_IMAGEN compara la CLAVE de storage, no la URL armada', () => {
    // La clave cruda es la identidad de la opción; la URL es sólo cómo se muestra.
    // Si la tablet mandara la URL, la respuesta correcta dejaría de matchear.
    const clave = 'preguntas/9f1c0f3e-0b3a-4c8e-9c1d-2b7a5e6f8a90.png';
    expect(esCorrecta(clave, clave)).toBe(true);
    expect(esCorrecta(clave, `http://localhost:3000/uploads/${clave}`)).toBe(
      false,
    );
  });

  it('no distingue de más ni de menos: es sensible a mayúsculas y espacios', () => {
    // Fija el contrato con la tablet: manda el string tal cual vino en `opciones`.
    expect(esCorrecta('Verdadero', 'verdadero')).toBe(false);
    expect(esCorrecta('Verdadero', 'Verdadero ')).toBe(false);
  });

  it('no contestar es incorrecto, no un error', () => {
    expect(esCorrecta('Verdadero', null)).toBe(false);
    expect(esCorrecta('Verdadero', undefined)).toBe(false);
    // Y una cadena vacía tampoco matchea por accidente.
    expect(esCorrecta('Verdadero', '')).toBe(false);
  });
});

describe('calcularResultado', () => {
  const correctas = (cuantas: number, total: number) =>
    Array.from({ length: total }, (_, i) => i < cuantas);

  it('el umbral por defecto es 70', () => {
    expect(UMBRAL_APROBACION_DEFAULT).toBe(70);
  });

  it('3 de 3 aprueba', () => {
    expect(calcularResultado(correctas(3, 3))).toEqual({
      correctas: 3,
      total: 3,
      porcentaje: 100,
      aprobada: true,
    });
  });

  it('2 de 3 desaprueba: 67% no llega al 70', () => {
    // El caso de la tablet (3 preguntas por evaluación): fallar una desaprueba.
    expect(calcularResultado(correctas(2, 3))).toEqual({
      correctas: 2,
      total: 3,
      porcentaje: 67,
      aprobada: false,
    });
  });

  it('7 de 10 aprueba: el borde exacto del umbral entra', () => {
    // >= y no >. Si esto se rompe, todo el que saque justo 70 pasa a desaprobar.
    expect(calcularResultado(correctas(7, 10))).toMatchObject({
      porcentaje: 70,
      aprobada: true,
    });
  });

  it('el redondeo es el que decide, y por eso se persiste', () => {
    // 69,5% redondea a 70 y APRUEBA; 69,4% redondea a 69 y no. Guardar el
    // porcentaje evita que mostrarlo más tarde con otro redondeo contradiga al
    // `aprobada` de la misma fila.
    expect(calcularResultado(correctas(139, 200))).toMatchObject({
      porcentaje: 70,
      aprobada: true,
    });
    expect(calcularResultado(correctas(1387, 2000))).toMatchObject({
      porcentaje: 69,
      aprobada: false,
    });
  });

  it('0 de 3 desaprueba', () => {
    expect(calcularResultado(correctas(0, 3))).toEqual({
      correctas: 0,
      total: 3,
      porcentaje: 0,
      aprobada: false,
    });
  });

  it('el MISMO score cambia de resultado según el umbral', () => {
    // Es el motivo por el que el umbral se congela en la Sesion en vez de leerse
    // de una constante al mostrar el resultado: subirlo a 80 mañana no puede
    // reescribir lo que decían los certificados ya emitidos.
    const siete = correctas(7, 10);
    expect(calcularResultado(siete, 70).aprobada).toBe(true);
    expect(calcularResultado(siete, 80).aprobada).toBe(false);
  });

  it('sin respuestas devuelve 0% y no aprobada, nunca NaN', () => {
    // En la práctica no pasa (el DTO exige al menos una), pero una función pura
    // no debería poder devolver NaN.
    expect(calcularResultado([])).toEqual({
      correctas: 0,
      total: 0,
      porcentaje: 0,
      aprobada: false,
    });
  });
});
