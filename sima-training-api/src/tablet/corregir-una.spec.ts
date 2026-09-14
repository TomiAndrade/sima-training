import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { corregirUna } from './corregir-una';

const VERSION = '11111111-1111-4111-8111-111111111111';
const PREGUNTA = '22222222-2222-4222-8222-222222222222';

describe('corregirUna', () => {
  let prisma: {
    moduloVersion: { findUnique: jest.Mock };
    moduloVersionPregunta: { findUnique: jest.Mock };
  };

  // Deja la base en el caso feliz: versión publicada y la pregunta pertenece a
  // ella. Cada test pisa sólo lo que le importa.
  const conBanco = (respuestaCorrecta: string | null = 'Verdadero') => {
    prisma.moduloVersion.findUnique.mockResolvedValue({
      id: VERSION,
      estado: 'ACTIVO',
    });
    prisma.moduloVersionPregunta.findUnique.mockResolvedValue({
      pregunta: { respuestaCorrecta },
    });
  };

  const corregir = (respuestaDada?: string | null) =>
    corregirUna(prisma as unknown as PrismaService, {
      moduloVersionId: VERSION,
      preguntaId: PREGUNTA,
      respuestaDada,
    });

  beforeEach(() => {
    prisma = {
      moduloVersion: { findUnique: jest.fn() },
      moduloVersionPregunta: { findUnique: jest.fn() },
    };
  });

  it('devuelve correcta=true cuando la respuesta coincide', async () => {
    conBanco('Verdadero');
    await expect(corregir('Verdadero')).resolves.toEqual({
      correcta: true,
      respuestaCorrecta: 'Verdadero',
    });
  });

  it('devuelve correcta=false y la correcta cuando erró', async () => {
    conBanco('Verdadero');
    // Que la respuestaCorrecta viaje también cuando erró es el punto del
    // endpoint: es lo que la app pinta en el resumen final de incorrectas.
    await expect(corregir('Falso')).resolves.toEqual({
      correcta: false,
      respuestaCorrecta: 'Verdadero',
    });
  });

  it('trata "no contestó" como incorrecta, no como error', async () => {
    conBanco('Verdadero');
    await expect(corregir(null)).resolves.toMatchObject({ correcta: false });
    await expect(corregir(undefined)).resolves.toMatchObject({
      correcta: false,
    });
  });

  it('compara la CLAVE cruda de storage en OPCIONES_IMAGEN', async () => {
    // Nunca la URL armada: la clave es la identidad de la opción (ver
    // corregir.ts y serializarOpciones). Si se comparara la URL, ninguna
    // opción de imagen quedaría bien nunca.
    conBanco('preguntas/abc.png');
    await expect(corregir('preguntas/abc.png')).resolves.toMatchObject({
      correcta: true,
    });
    await expect(
      corregir('https://api/uploads/preguntas/abc.png'),
    ).resolves.toMatchObject({ correcta: false });
  });

  it('404 si la versión no existe', async () => {
    prisma.moduloVersion.findUnique.mockResolvedValue(null);
    await expect(corregir('Verdadero')).rejects.toThrow(NotFoundException);
  });

  it('409 sobre un BORRADOR: no se rinde, no se corrige', async () => {
    prisma.moduloVersion.findUnique.mockResolvedValue({
      id: VERSION,
      estado: 'BORRADOR',
    });
    await expect(corregir('Verdadero')).rejects.toThrow(ConflictException);
  });

  it('400 si la pregunta no pertenece a la versión que se rinde', async () => {
    // EL test que importa: sin esta validación el endpoint sería un oráculo
    // para pedir la respuesta correcta de cualquier pregunta del banco por id.
    prisma.moduloVersion.findUnique.mockResolvedValue({
      id: VERSION,
      estado: 'ACTIVO',
    });
    prisma.moduloVersionPregunta.findUnique.mockResolvedValue(null);
    await expect(corregir('Verdadero')).rejects.toThrow(BadRequestException);
  });

  it('400 si la pregunta no tiene respuesta correcta cargada', async () => {
    // Mismo criterio que crearSesion(): se rechaza en vez de contestar
    // "incorrecta" y pintarle un error en rojo a alguien por un dato faltante
    // nuestro.
    conBanco(null);
    await expect(corregir('lo que sea')).rejects.toThrow(BadRequestException);
  });

  it('no filtra por `activa`: una baja a mitad de la rendición no cambia la corrección', async () => {
    conBanco('Verdadero');
    await corregir('Verdadero');
    const where = prisma.moduloVersionPregunta.findUnique.mock.calls[0][0].where;
    expect(where).toEqual({
      moduloVersionId_preguntaId: {
        moduloVersionId: VERSION,
        preguntaId: PREGUNTA,
      },
    });
  });
});
