import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';
import { leerRequestIdHeader, runWithRequestId } from './request-context';

export const REQUEST_ID_HEADER = 'X-Request-Id';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const requestId = leerRequestIdHeader(req.headers) ?? randomUUID();
    res.setHeader(REQUEST_ID_HEADER, requestId);
    runWithRequestId(requestId, () => next());
  }
}
