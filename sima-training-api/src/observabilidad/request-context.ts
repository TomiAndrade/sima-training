import { AsyncLocalStorage } from 'node:async_hooks';

interface RequestContext {
  requestId: string;
}

// Singleton de módulo y no una clase inyectable por DI: el logger custom se
// instancia con `new` en main.ts antes de que exista el contenedor de Nest, así
// que necesita poder leer el contexto sin pasar por injection. Esto es también
// lo que evita pasar el requestId por parámetro a cada service.
const requestContextStorage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestId<T>(requestId: string, fn: () => T): T {
  return requestContextStorage.run({ requestId }, fn);
}

export function getRequestId(): string | undefined {
  return requestContextStorage.getStore()?.requestId;
}

// Compartido entre el middleware (que arma el contexto) y el filtro global de
// excepciones (que necesita el mismo valor como fallback cuando el middleware
// nunca llegó a correr — ver el caso de body-parser fallando antes en la cadena).
export function leerRequestIdHeader(
  headers: Record<string, string | string[] | undefined>,
): string | undefined {
  const valor = headers['x-request-id'];
  return Array.isArray(valor) ? valor[0] : valor;
}
