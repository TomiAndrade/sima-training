// Funciones puras de redacción. Hoy no hay ningún caller que loguee un body o
// un set de headers completo (el filtro y el interceptor sólo loguean método,
// ruta y status) — quedan listas y testeadas para cuando haga falta: un logging
// más detallado en desarrollo, o la integración con Sentry más adelante.

const MARCA_REDACTADO = '[REDACTADO]';

const CAMPOS_SENSIBLES = new Set(['password', 'pin', 'token', 'access_token']);

export function redactarHeaders(
  headers: Record<string, unknown>,
): Record<string, unknown> {
  const resultado: Record<string, unknown> = {};
  for (const [clave, valor] of Object.entries(headers)) {
    resultado[clave] =
      clave.toLowerCase() === 'authorization' ? MARCA_REDACTADO : valor;
  }
  return resultado;
}

export function redactarBody(body: unknown): unknown {
  if (Array.isArray(body)) {
    return body.map(redactarBody);
  }
  if (body === null || typeof body !== 'object') {
    return body;
  }
  const resultado: Record<string, unknown> = {};
  for (const [clave, valor] of Object.entries(
    body as Record<string, unknown>,
  )) {
    resultado[clave] = CAMPOS_SENSIBLES.has(clave.toLowerCase())
      ? MARCA_REDACTADO
      : redactarBody(valor);
  }
  return resultado;
}
