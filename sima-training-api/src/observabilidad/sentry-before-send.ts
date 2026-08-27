import type { ErrorEvent } from '@sentry/nestjs';
import { redactarBody, redactarHeaders } from './redactar-sensible';

// Primer consumidor real de redactarHeaders/redactarBody: sin esto, un evento
// de Sentry con el request completo mandaría el Authorization y cualquier
// password/pin/token del body tal cual, aunque el log del servidor ya los
// redacte.
export function redactarEventoSentry(event: ErrorEvent): ErrorEvent {
  if (event.request?.headers) {
    event.request.headers = redactarHeaders(event.request.headers) as Record<
      string,
      string
    >;
  }
  if (event.request?.data !== undefined) {
    event.request.data = redactarBody(event.request.data);
  }
  return event;
}
