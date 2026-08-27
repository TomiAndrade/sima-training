import { redactarBody, redactarHeaders } from './redactar-sensible';

describe('redactarHeaders', () => {
  it('oculta Authorization tal cual viene', () => {
    expect(redactarHeaders({ authorization: 'Bearer secreto' })).toEqual({
      authorization: '[REDACTADO]',
    });
  });

  it('es case-insensitive con el nombre del header', () => {
    expect(redactarHeaders({ Authorization: 'Bearer secreto' })).toEqual({
      Authorization: '[REDACTADO]',
    });
  });

  it('no toca headers que no son sensibles', () => {
    expect(
      redactarHeaders({
        'content-type': 'application/json',
        'x-request-id': 'abc',
      }),
    ).toEqual({ 'content-type': 'application/json', 'x-request-id': 'abc' });
  });

  it('no muta el objeto original', () => {
    const original = { authorization: 'Bearer secreto' };
    redactarHeaders(original);
    expect(original).toEqual({ authorization: 'Bearer secreto' });
  });
});

describe('redactarBody', () => {
  it('oculta password, pin, token y access_token', () => {
    expect(
      redactarBody({
        password: '1234',
        pin: '5678',
        token: 'tok',
        access_token: 'at',
        nombre: 'Juan',
      }),
    ).toEqual({
      password: '[REDACTADO]',
      pin: '[REDACTADO]',
      token: '[REDACTADO]',
      access_token: '[REDACTADO]',
      nombre: 'Juan',
    });
  });

  it('es case-insensitive con el nombre del campo', () => {
    expect(redactarBody({ Password: '1234', PIN: '5678' })).toEqual({
      Password: '[REDACTADO]',
      PIN: '[REDACTADO]',
    });
  });

  it('redacta campos sensibles anidados', () => {
    expect(
      redactarBody({
        usuario: { nombre: 'Juan', credenciales: { password: '1234' } },
      }),
    ).toEqual({
      usuario: { nombre: 'Juan', credenciales: { password: '[REDACTADO]' } },
    });
  });

  it('redacta dentro de arrays de objetos', () => {
    expect(redactarBody([{ password: '1234' }, { nombre: 'Juan' }])).toEqual([
      { password: '[REDACTADO]' },
      { nombre: 'Juan' },
    ]);
  });

  it('deja pasar valores primitivos sin tocar', () => {
    expect(redactarBody('un string cualquiera')).toBe('un string cualquiera');
    expect(redactarBody(42)).toBe(42);
    expect(redactarBody(null)).toBeNull();
  });

  it('no muta el objeto original', () => {
    const original = { password: '1234', usuario: { pin: '5678' } };
    redactarBody(original);
    expect(original).toEqual({ password: '1234', usuario: { pin: '5678' } });
  });
});
