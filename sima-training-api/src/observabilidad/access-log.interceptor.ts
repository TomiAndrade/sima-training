import {
  CallHandler,
  ExecutionContext,
  Logger,
  LoggerService,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';

// Sin esto el requestId sólo aparece en el log cuando algo tira una excepción —
// y el caso que más cuesta debuggear ("¿esto se llegó a ejecutar? ¿cuánto
// tardó?") es justo el que no falla.
export class AccessLogInterceptor implements NestInterceptor {
  constructor(
    private readonly logger: LoggerService = new Logger(
      AccessLogInterceptor.name,
    ),
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // El health check de Render pega acá cada pocos segundos: lo excluimos para
    // que no ahogue el resto del log.
    if (request.method === 'GET' && request.originalUrl === '/health') {
      return next.handle();
    }

    const inicio = Date.now();
    const { method, originalUrl } = request;

    // Enganchado al evento nativo de Express y no a un operador RxJS (`tap`):
    // en el momento en que `tap` corre, `response.statusCode` todavía no está
    // seteado (ni en el camino de éxito ni en el de error) porque Nest —o el
    // filtro global de excepciones— lo fija recién al mandar la respuesta real.
    // `'finish'` dispara una sola vez, ya con el status definitivo, y el
    // requestId del contexto de ALS sigue siendo el correcto porque el listener
    // se registra dentro del mismo call stack que abrió ese contexto.
    response.on('finish', () => {
      const duracionMs = Date.now() - inicio;
      const linea = `${method} ${originalUrl} ${response.statusCode} ${duracionMs}ms`;
      // Sin contexto explícito acá: `this.logger` ya es un `Logger` construido
      // con ese contexto, y lo vuelve a agregar solo en cada llamada —
      // pasarlo de nuevo lo duplica y ConsoleLogger interpreta esa copia
      // extra como un mensaje (o, en error(), un "stack") más, partiendo la
      // línea en dos.
      if (response.statusCode >= 500) {
        this.logger.error(linea);
      } else if (response.statusCode >= 400) {
        this.logger.warn(linea);
      } else {
        this.logger.log(linea);
      }
    });

    return next.handle();
  }
}
