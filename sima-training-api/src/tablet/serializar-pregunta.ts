import { TipoPregunta } from '@prisma/client';
import { resolverUrlImagen } from '../storage/url-imagen';

// Cómo se le sirve una pregunta a la tablet. Vive en su propio archivo —y no
// como función privada de TabletService— porque la usan los DOS flujos de
// rendición: el real (TabletService.examen) y el de invitado
// (InvitadoService.examen).
//
// Que sea uno solo es la garantía, no una comodidad: la regla de que
// `respuestaCorrecta` nunca viaja al cliente se cumple en un lugar y no en dos
// que puedan divergir. La segunda línea de defensa sigue siendo el `select` de
// Prisma de cada llamador, que directamente no la trae — por eso el parámetro de
// abajo no la tiene ni como campo opcional: pasarla sería un error de tipos.

// Traduce una Pregunta del banco a lo que se manda a la tablet. CRÍTICO:
// `respuestaCorrecta` no entra por diseño — todo lo que devuelve esta función se
// ve abriendo las devtools del examen.
export function serializarPregunta(pregunta: {
  id: string;
  texto: string;
  tipo: TipoPregunta;
  imagen: string | null;
  opciones: unknown;
}) {
  return {
    id: pregunta.id,
    texto: pregunta.texto,
    tipo: pregunta.tipo,
    imagen: pregunta.imagen
      ? { clave: pregunta.imagen, url: resolverUrlImagen(pregunta.imagen) }
      : null,
    opciones: serializarOpciones(pregunta.tipo, pregunta.opciones),
  };
}

// OPCION_MULTIPLE / VERDADERO_FALSO: el jsonb tal cual (array de strings).
// OPCIONES_IMAGEN: cada string del jsonb es una CLAVE de storage — se traduce
// a { clave, url } (la app muestra `url` y manda `clave` de vuelta como
// respuesta; corregir.ts compara esa clave cruda, no la URL armada).
export function serializarOpciones(tipo: TipoPregunta, opciones: unknown) {
  const lista = Array.isArray(opciones) ? (opciones as string[]) : [];
  if (tipo === 'OPCIONES_IMAGEN') {
    return lista.map((clave) => ({ clave, url: resolverUrlImagen(clave) }));
  }
  return lista;
}
