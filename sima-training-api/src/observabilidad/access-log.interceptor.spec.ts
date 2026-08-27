import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { AccessLogInterceptor } from './access-log.interceptor';

function crearContexto(
  overrides: { method?: string; originalUrl?: string } = {},
) {
  const request = {
    method: overrides.method ?? 'GET',
    originalUrl: overrides.originalUrl ?? '/algo',
  };
  const response = { statusCode: 200, on: jest.fn() };
  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;
  return { context, response };
}

function crearLoggerMock() {
  return {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
  };
}

// Simula que la respuesta terminó de mandarse, disparando el listener que el
// interceptor enganchó a `res.on('finish', ...)`.
function dispararFinish(response: { on: jest.Mock }) {
  const llamada = response.on.mock.calls.find(
    ([evento]: [string]) => evento === 'finish',
  );
  if (!llamada) throw new Error('El interceptor no enganchó el evento finish');
  llamada[1]();
}

describe('AccessLogInterceptor', () => {
  const next: CallHandler = { handle: () => of('resultado') };

  it('loguea con log() una respuesta 2xx', () => {
    const logger = crearLoggerMock();
    const interceptor = new AccessLogInterceptor(logger);
    const { context, response } = crearContexto({
      method: 'GET',
      originalUrl: '/usuarios',
    });
    response.statusCode = 200;

    interceptor.intercept(context, next).subscribe();
    dispararFinish(response);

    expect(logger.log).toHaveBeenCalledWith(
      expect.stringMatching(/^GET \/usuarios 200 \d+ms$/),
      'AccessLogInterceptor',
    );
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('loguea con warn() una respuesta 4xx', () => {
    const logger = crearLoggerMock();
    const interceptor = new AccessLogInterceptor(logger);
    const { context, response } = crearContexto({
      method: 'POST',
      originalUrl: '/reglas-asignacion',
    });
    response.statusCode = 409;

    interceptor.intercept(context, next).subscribe();
    dispararFinish(response);

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringMatching(/^POST \/reglas-asignacion 409 \d+ms$/),
      'AccessLogInterceptor',
    );
    expect(logger.log).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('loguea con error() una respuesta 5xx', () => {
    const logger = crearLoggerMock();
    const interceptor = new AccessLogInterceptor(logger);
    const { context, response } = crearContexto();
    response.statusCode = 500;

    interceptor.intercept(context, next).subscribe();
    dispararFinish(response);

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringMatching(/^GET \/algo 500 \d+ms$/),
      'AccessLogInterceptor',
    );
  });

  it('GET /health no engancha ningún listener, para no llenar los logs del health check', () => {
    const logger = crearLoggerMock();
    const interceptor = new AccessLogInterceptor(logger);
    const { context, response } = crearContexto({
      method: 'GET',
      originalUrl: '/health',
    });

    interceptor.intercept(context, next).subscribe();

    expect(response.on).not.toHaveBeenCalled();
  });
});
