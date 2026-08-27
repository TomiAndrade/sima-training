import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
  LoggerService,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Request, Response } from 'express';
import {
  getRequestId,
  leerRequestIdHeader,
  runWithRequestId,
} from './request-context';
import { REQUEST_ID_HEADER } from './request-id.middleware';

interface RespuestaError {
  status: number;
  message: string | string[];
  error: string;
}

const MENSAJE_GENERICO = 'Error interno del servidor';

function resolverRespuesta(exception: unknown): RespuestaError {
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const body = exception.getResponse();
    // El shape default de Nest ya es un objeto {statusCode, message, error} para
    // toda excepción construida con un string (100% del uso actual del repo).
    // El caso "string crudo" solo puede darse con un HttpException armado a mano
    // de otra forma — se contempla igual por robustez, mismo criterio que usa el
    // BaseExceptionFilter interno de Nest.
    if (typeof body === 'string') {
      return { status, message: body, error: exception.name };
    }
    const objeto = body as { message?: string | string[]; error?: string };
    return {
      status,
      message: objeto.message ?? exception.message,
      error: objeto.error ?? exception.name,
    };
  }
  // Cualquier excepción no controlada: nunca se expone su mensaje ni su stack al
  // cliente, solo un genérico. El detalle real va al log del servidor.
  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    message: MENSAJE_GENERICO,
    error: 'Internal Server Error',
  };
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly logger: LoggerService = new Logger(
      GlobalExceptionFilter.name,
    ),
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    // No se puede asumir que el middleware corrió: si body-parser falla antes
    // (ej. JSON malformado), el ALS nunca se inicializó para este request.
    const requestId =
      getRequestId() ?? leerRequestIdHeader(request.headers) ?? randomUUID();

    // Se re-entra al contexto de ALS con ese mismo id (ya sea el que traía el
    // request o el recién generado por el fallback de arriba): si no, cuando
    // el requestId sale del fallback, el logger no lo ve en el momento de
    // imprimir y la línea queda como "sin-request-id" aunque la respuesta al
    // cliente sí lleve el id real — justo el caso que rompe la correlación.
    runWithRequestId(requestId, () => {
      const { status, message, error } = resolverRespuesta(exception);

      const linea = `${request.method} ${request.originalUrl} → ${status}`;
      if (status >= 500) {
        const stack = exception instanceof Error ? exception.stack : undefined;
        // Sin un tercer argumento de contexto acá: `this.logger` ya es un
        // `Logger` construido con ese contexto (ver el constructor de la
        // clase), y `Logger.prototype.error/warn` lo vuelve a agregar solo en
        // cada llamada. Pasarlo de nuevo lo duplica, y `ConsoleLogger`
        // interpreta esa copia extra como un mensaje (o un stack) más,
        // partiendo la línea en dos y — en `error()` — corrompiendo el stack
        // real con el nombre de la clase.
        this.logger.error(linea, stack);
      } else {
        // 4xx de negocio: son errores esperados, no fallas de la aplicación.
        // Sin esta distinción, los 400 de ValidationPipe y los 409 de
        // duplicado tapan los 500 reales en el log.
        this.logger.warn(linea);
      }

      if (response.headersSent) return;

      response.setHeader(REQUEST_ID_HEADER, requestId);
      response
        .status(status)
        .json({ statusCode: status, message, error, requestId });
    });
  }
}
