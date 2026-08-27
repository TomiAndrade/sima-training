import type { ErrorEvent } from '@sentry/nestjs';
import { redactarEventoSentry } from './sentry-before-send';

describe('redactarEventoSentry', () => {
  it('redacta el header Authorization del evento', () => {
    const event = {
      request: {
        headers: { authorization: 'Bearer secreto', 'x-request-id': 'abc' },
      },
    } as unknown as ErrorEvent;

    const resultado = redactarEventoSentry(event);

    expect(resultado.request?.headers).toEqual({
      authorization: '[REDACTADO]',
      'x-request-id': 'abc',
    });
  });

  it('redacta campos sensibles del body del evento', () => {
    const event = {
      request: { data: { password: '1234', nombre: 'Juan' } },
    } as unknown as ErrorEvent;

    const resultado = redactarEventoSentry(event);

    expect(resultado.request?.data).toEqual({
      password: '[REDACTADO]',
      nombre: 'Juan',
    });
  });

  it('un evento sin request no rompe (nada que redactar)', () => {
    const event = {} as unknown as ErrorEvent;

    expect(() => redactarEventoSentry(event)).not.toThrow();
    expect(redactarEventoSentry(event)).toEqual({});
  });

  it('un request sin headers ni data no rompe', () => {
    const event = {
      request: { url: 'https://api/algo' },
    } as unknown as ErrorEvent;

    const resultado = redactarEventoSentry(event);

    expect(resultado.request).toEqual({ url: 'https://api/algo' });
  });

  it('devuelve el mismo evento (mutado), no uno nuevo, para no romper el resto del pipeline de Sentry', () => {
    const event = {
      request: { headers: { authorization: 'x' } },
    } as unknown as ErrorEvent;

    const resultado = redactarEventoSentry(event);

    expect(resultado).toBe(event);
  });
});
