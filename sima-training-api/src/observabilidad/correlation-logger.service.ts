import { ConsoleLogger, LogLevel } from '@nestjs/common';
import { getRequestId } from './request-context';

// Extiende ConsoleLogger (el logger default de Nest) en vez de reimplementar el
// formato desde cero. Overridea únicamente `printMessages`: todos los métodos
// públicos (log/error/warn/debug/verbose/fatal) delegan en él, así que prefijar
// ahí cubre los seis sin duplicar código ni arriesgarse a que un método nuevo
// (ej. `fatal`, agregado en Nest 11) se quede sin el requestId por descuido.
export class CorrelationLogger extends ConsoleLogger {
  protected printMessages(
    messages: unknown[],
    context?: string,
    logLevel?: LogLevel,
    writeStreamType?: 'stdout' | 'stderr',
    errorStack?: unknown,
  ): void {
    const requestId = getRequestId() ?? 'sin-request-id';
    const contextoConId = context ? `${context} · ${requestId}` : requestId;
    super.printMessages(
      messages,
      contextoConId,
      logLevel,
      writeStreamType,
      errorStack,
    );
  }
}
