import {
  ArgumentsHost,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter';
import { getRequestId, runWithRequestId } from './request-context';

function crearHost(
  overrides: {
    method?: string;
    originalUrl?: string;
    headers?: Record<string, string>;
  } = {},
) {
  const request = {
    method: overrides.method ?? 'GET',
    originalUrl: overrides.originalUrl ?? '/algo',
    headers: overrides.headers ?? {},
  };
  const response = {
    headersSent: false,
    setHeader: jest.fn(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;
  return { host, request, response };
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

describe('GlobalExceptionFilter', () => {
  it('HttpException de negocio (409) respeta status, message y error', () => {
    const filter = new GlobalExceptionFilter(crearLoggerMock());
    const { host, response } = crearHost();

    filter.catch(new ConflictException('Ya existe una regla'), host);

    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 409,
        message: 'Ya existe una regla',
        error: 'Conflict',
      }),
    );
  });

  it('excepción no controlada da 500 con mensaje genérico, nunca el original', () => {
    const filter = new GlobalExceptionFilter(crearLoggerMock());
    const { host, response } = crearHost();

    filter.catch(new Error('detalle interno sensible'), host);

    expect(response.status).toHaveBeenCalledWith(500);
    const body = response.json.mock.calls[0][0];
    expect(body.message).toBe('Error interno del servidor');
    expect(JSON.stringify(body)).not.toContain('detalle interno sensible');
  });

  it('preserva message como array (shape de ValidationPipe)', () => {
    const filter = new GlobalExceptionFilter(crearLoggerMock());
    const { host, response } = crearHost();

    filter.catch(
      new BadRequestException(['campo x es obligatorio', 'campo y inválido']),
      host,
    );

    const body = response.json.mock.calls[0][0];
    expect(Array.isArray(body.message)).toBe(true);
    expect(body.message).toEqual([
      'campo x es obligatorio',
      'campo y inválido',
    ]);
  });

  it('el body y el header incluyen el requestId del contexto de ALS', () => {
    const filter = new GlobalExceptionFilter(crearLoggerMock());
    const { host, response } = crearHost();

    runWithRequestId('req-del-contexto', () => {
      filter.catch(new ConflictException('dup'), host);
    });

    expect(response.setHeader).toHaveBeenCalledWith(
      'X-Request-Id',
      'req-del-contexto',
    );
    expect(response.json.mock.calls[0][0].requestId).toBe('req-del-contexto');
  });

  it('sin contexto de ALS, usa el header entrante como fallback', () => {
    // Simula el gap de body-parser: el middleware nunca llegó a correr, así que
    // el ALS no tiene store, pero el header sí venía en la request original.
    const filter = new GlobalExceptionFilter(crearLoggerMock());
    const { host, response } = crearHost({
      headers: { 'x-request-id': 'del-header' },
    });

    filter.catch(new ConflictException('dup'), host);

    expect(response.json.mock.calls[0][0].requestId).toBe('del-header');
  });

  it('sin ALS y sin header entrante, igual genera uno (nunca deja el campo vacío)', () => {
    const filter = new GlobalExceptionFilter(crearLoggerMock());
    const { host, response } = crearHost();

    filter.catch(new ConflictException('dup'), host);

    const { requestId } = response.json.mock.calls[0][0];
    expect(typeof requestId).toBe('string');
    expect(requestId.length).toBeGreaterThan(0);
  });

  it('un 500 se loguea con error() y stack completo, no con warn()', () => {
    const logger = crearLoggerMock();
    const filter = new GlobalExceptionFilter(logger);
    const { host } = crearHost();
    const error = new Error('boom');

    filter.catch(error, host);

    // Sin un tercer argumento de contexto: `this.logger` ya lo agrega solo
    // (es un Logger construido con ese contexto) — pasarlo de nuevo lo
    // duplicaría y ConsoleLogger lo confundiría con un mensaje/stack más.
    expect(logger.error).toHaveBeenCalledWith(expect.any(String), error.stack);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('un 409 de negocio se loguea con warn(), sin stack, no con error()', () => {
    const logger = crearLoggerMock();
    const filter = new GlobalExceptionFilter(logger);
    const { host } = crearHost();

    filter.catch(new ConflictException('dup'), host);

    expect(logger.warn).toHaveBeenCalledWith(expect.any(String));
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('durante el log, el contexto de ALS ya tiene el requestId resuelto (incluso el del fallback)', () => {
    // Regresión: el filtro resolvía el requestId de fallback en una variable
    // local pero nunca lo escribía al ALS antes de loguear — el logger real
    // (que lee `getRequestId()` al imprimir) quedaba viendo "sin-request-id"
    // aunque la respuesta al cliente sí llevara el id correcto. Acá el mock
    // de logger lee el ALS en el momento de la llamada, como haría el logger
    // real, para poder detectar exactamente ese desfasaje.
    let idVistoAlLoguear: string | undefined;
    const logger = {
      ...crearLoggerMock(),
      warn: jest.fn(() => {
        idVistoAlLoguear = getRequestId();
      }),
    };
    const filter = new GlobalExceptionFilter(logger);
    const { host, response } = crearHost({
      headers: { 'x-request-id': 'del-header-para-el-log' },
    });

    filter.catch(new ConflictException('dup'), host);

    expect(idVistoAlLoguear).toBe('del-header-para-el-log');
    expect(response.json.mock.calls[0][0].requestId).toBe(
      'del-header-para-el-log',
    );
  });

  it('si la respuesta ya se envió (headersSent), no vuelve a escribir', () => {
    const filter = new GlobalExceptionFilter(crearLoggerMock());
    const { host, response } = crearHost();
    response.headersSent = true;

    filter.catch(new ConflictException('dup'), host);

    expect(response.status).not.toHaveBeenCalled();
    expect(response.json).not.toHaveBeenCalled();
  });
});
