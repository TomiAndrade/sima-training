// Tiene que ser el PRIMER import de main.ts, antes que cualquier otro módulo
// (incluido AppModule): Sentry necesita instrumentar antes de que se carguen
// los módulos de Nest. Por eso también carga dotenv acá mismo en vez de
// depender de que ConfigModule.forRoot() lo haga — ese recién corre después,
// cuando AppModule arranca, y para entonces SENTRY_DSN ya se leyó.
import 'dotenv/config';
import * as Sentry from '@sentry/nestjs';
import { redactarEventoSentry } from './observabilidad/sentry-before-send';

Sentry.init({
  // Vacía en desarrollo local y en los tests: el SDK queda desactivado sin
  // romper nada (documentado — "si no está seteada, no manda eventos").
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  sendDefaultPii: false,
  beforeSend: redactarEventoSentry,
  // Sin tracesSampleRate ni integraciones de tracing: sin esto, ninguna se
  // activa. No hace falta consumir cuota del plan free en algo que no se pidió.
});
