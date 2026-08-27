import { getRequestId } from './request-context';
import {
  REQUEST_ID_HEADER,
  RequestIdMiddleware,
} from './request-id.middleware';

function crearReqRes(headers: Record<string, string | string[]> = {}) {
  const req = { headers } as any;
  const res = { setHeader: jest.fn() } as any;
  return { req, res };
}

describe('RequestIdMiddleware', () => {
  const middleware = new RequestIdMiddleware();

  it('genera un uuid nuevo si la request no trae X-Request-Id', () => {
    const { req, res } = crearReqRes();
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const [, requestIdSeteado] = res.setHeader.mock.calls[0];
    expect(requestIdSeteado).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('reusa el X-Request-Id entrante en vez de generar uno nuevo', () => {
    const { req, res } = crearReqRes({ 'x-request-id': 'abc-123' });
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, 'abc-123');
  });

  it('si el header entrante viene repetido (array), usa el primer valor', () => {
    const { req, res } = crearReqRes({
      'x-request-id': ['primero', 'segundo'],
    });
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, 'primero');
  });

  it('setea el header de respuesta con el mismo requestId que propaga por ALS', () => {
    const { req, res } = crearReqRes({ 'x-request-id': 'mismo-id' });
    let idDentroDelContexto: string | undefined;
    const next = jest.fn(() => {
      idDentroDelContexto = getRequestId();
    });

    middleware.use(req, res, next);

    expect(idDentroDelContexto).toBe('mismo-id');
    expect(res.setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, 'mismo-id');
  });

  it('fuera del callback de next, el contexto no tiene requestId', () => {
    expect(getRequestId()).toBeUndefined();
  });
});
