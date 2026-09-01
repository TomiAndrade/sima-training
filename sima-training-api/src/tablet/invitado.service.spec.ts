import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { InvitadoService } from './invitado.service';
import { PREGUNTAS_POR_EXAMEN } from './tablet.service';

const VERSION_ID = '11111111-1111-4111-8111-111111111111';
const MODULO_ID = '22222222-2222-4222-8222-222222222222';
const PREGUNTA_A = '33333333-3333-4333-8333-333333333333';
const PREGUNTA_B = '44444444-4444-4444-8444-444444444444';

describe('InvitadoService', () => {
  let service: InvitadoService;
  let prisma: {
    modulo: { findMany: jest.Mock; findUnique: jest.Mock };
    moduloVersion: { findUnique: jest.Mock };
    moduloVersionPregunta: { findMany: jest.Mock };
    sesionInvitado: { create: jest.Mock };
  };
  let jwt: { sign: jest.Mock };
  let config: { get: jest.Mock };

  // Una versión publicada de un módulo que SÍ está en la demo. Los tests que
  // prueban el caso contrario lo pisan.
  const versionDeDemo = (extra: Record<string, unknown> = {}) => ({
    id: VERSION_ID,
    estado: 'ACTIVO',
    umbralAprobacion: null,
    modulo: { id: MODULO_ID, demoPublico: true },
    ...extra,
  });

  const rendirUnaCorrecta = {
    moduloVersionId: VERSION_ID,
    finalizadaEn: new Date('2026-09-01T10:00:00Z'),
    respuestas: [{ preguntaId: PREGUNTA_A, respuestaDada: 'Verdadero' }],
  };

  beforeEach(async () => {
    prisma = {
      modulo: { findMany: jest.fn(), findUnique: jest.fn() },
      moduloVersion: { findUnique: jest.fn() },
      moduloVersionPregunta: { findMany: jest.fn() },
      sesionInvitado: { create: jest.fn() },
    };
    jwt = { sign: jest.fn().mockReturnValue('fake.jwt.token') };
    config = { get: jest.fn().mockReturnValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvitadoService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get(InvitadoService);
  });

  // --- login ------------------------------------------------------------

  it('firma un token con tipo invitado y el nombre, SIN sub', () => {
    const res = service.login({ nombre: 'Juan Pérez' });

    expect(jwt.sign).toHaveBeenCalledWith(
      { tipo: 'invitado', nombre: 'Juan Pérez' },
      { expiresIn: '30m' },
    );
    // Que no haya `sub` es la garantía estructural del modo: sin id de usuario,
    // este token no puede pedir los datos de nadie.
    expect(jwt.sign.mock.calls[0][0]).not.toHaveProperty('sub');
    expect(res).toEqual({
      access_token: 'fake.jwt.token',
      invitado: { nombre: 'Juan Pérez' },
    });
  });

  it('respeta TABLET_INVITADO_JWT_EXPIRES_IN si está configurada', () => {
    config.get.mockReturnValue('10m');
    service.login({ nombre: 'Ana' });

    expect(jwt.sign).toHaveBeenCalledWith(expect.anything(), {
      expiresIn: '10m',
    });
  });

  it('no consulta la base para entrar: no hay nada contra qué validar', () => {
    service.login({ nombre: 'Ana' });
    expect(prisma.modulo.findMany).not.toHaveBeenCalled();
  });

  // --- modulos ----------------------------------------------------------

  it('lista sólo módulos demoPublico, activos y con versión ACTIVO', async () => {
    prisma.modulo.findMany.mockResolvedValue([]);
    await service.modulos();

    expect(prisma.modulo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          demoPublico: true,
          activo: true,
          versiones: { some: { estado: 'ACTIVO' } },
        },
      }),
    );
  });

  it('devuelve lista vacía sin error si nadie configuró la demo', async () => {
    prisma.modulo.findMany.mockResolvedValue([]);
    await expect(service.modulos()).resolves.toEqual([]);
  });

  it('aplana la versión ACTIVO de cada módulo', async () => {
    prisma.modulo.findMany.mockResolvedValue([
      {
        id: MODULO_ID,
        nombre: 'SIMA Básico',
        descripcion: 'Inducción',
        versiones: [{ id: VERSION_ID, anio: 2026, mayor: 1, menor: 0 }],
      },
    ]);

    await expect(service.modulos()).resolves.toEqual([
      {
        moduloId: MODULO_ID,
        nombre: 'SIMA Básico',
        descripcion: 'Inducción',
        version: { id: VERSION_ID, anio: 2026, mayor: 1, menor: 0 },
      },
    ]);
  });

  // --- examen -----------------------------------------------------------

  // El chequeo que impide que el modo invitado sea una puerta abierta al banco.
  it('404 si el módulo existe pero NO es demoPublico', async () => {
    prisma.modulo.findUnique.mockResolvedValue({
      id: MODULO_ID,
      activo: true,
      demoPublico: false,
      versiones: [{ id: VERSION_ID, preguntasPorExamen: null }],
    });

    await expect(service.examen(MODULO_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    // No llegó a pedir preguntas: se corta antes de tocar el banco.
    expect(prisma.moduloVersionPregunta.findMany).not.toHaveBeenCalled();
  });

  it('404 si el módulo está dado de baja aunque sea demoPublico', async () => {
    prisma.modulo.findUnique.mockResolvedValue({
      id: MODULO_ID,
      activo: false,
      demoPublico: true,
      versiones: [{ id: VERSION_ID, preguntasPorExamen: null }],
    });

    await expect(service.examen(MODULO_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('409 si el módulo de demo no tiene versión publicada', async () => {
    prisma.modulo.findUnique.mockResolvedValue({
      id: MODULO_ID,
      activo: true,
      demoPublico: true,
      versiones: [],
    });

    await expect(service.examen(MODULO_ID)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('409 si la versión no tiene preguntas activas', async () => {
    prisma.modulo.findUnique.mockResolvedValue({
      id: MODULO_ID,
      activo: true,
      demoPublico: true,
      versiones: [{ id: VERSION_ID, preguntasPorExamen: null }],
    });
    prisma.moduloVersionPregunta.findMany.mockResolvedValue([]);

    await expect(service.examen(MODULO_ID)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('sortea la cantidad que declara la versión y nunca devuelve respuestaCorrecta', async () => {
    prisma.modulo.findUnique.mockResolvedValue({
      id: MODULO_ID,
      nombre: 'SIMA Básico',
      descripcion: null,
      activo: true,
      demoPublico: true,
      versiones: [
        { id: VERSION_ID, anio: 2026, mayor: 1, menor: 0, preguntasPorExamen: 1 },
      ],
    });
    prisma.moduloVersionPregunta.findMany.mockResolvedValue([
      {
        pregunta: {
          id: PREGUNTA_A,
          texto: '¿Es obligatorio el casco?',
          tipo: 'VERDADERO_FALSO',
          imagen: null,
          opciones: [],
        },
      },
      {
        pregunta: {
          id: PREGUNTA_B,
          texto: 'Otra',
          tipo: 'VERDADERO_FALSO',
          imagen: null,
          opciones: [],
        },
      },
    ]);

    const examen = await service.examen(MODULO_ID);

    expect(examen.preguntas).toHaveLength(1);
    expect(examen.moduloVersionId).toBe(VERSION_ID);
    expect(JSON.stringify(examen)).not.toContain('respuestaCorrecta');
  });

  it('cae al default global de preguntas si la versión no declara cuántas', async () => {
    prisma.modulo.findUnique.mockResolvedValue({
      id: MODULO_ID,
      nombre: 'SIMA Básico',
      descripcion: null,
      activo: true,
      demoPublico: true,
      versiones: [
        {
          id: VERSION_ID,
          anio: 2026,
          mayor: 1,
          menor: 0,
          preguntasPorExamen: null,
        },
      ],
    });
    prisma.moduloVersionPregunta.findMany.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => ({
        pregunta: {
          id: `pregunta-${i}`,
          texto: `Pregunta ${i}`,
          tipo: 'VERDADERO_FALSO',
          imagen: null,
          opciones: [],
        },
      })),
    );

    const examen = await service.examen(MODULO_ID);
    expect(examen.preguntas).toHaveLength(PREGUNTAS_POR_EXAMEN);
  });

  it('sólo pide preguntas activas en el pivot y en la pregunta', async () => {
    prisma.modulo.findUnique.mockResolvedValue({
      id: MODULO_ID,
      nombre: 'M',
      descripcion: null,
      activo: true,
      demoPublico: true,
      versiones: [{ id: VERSION_ID, preguntasPorExamen: 1 }],
    });
    prisma.moduloVersionPregunta.findMany.mockResolvedValue([
      {
        pregunta: {
          id: PREGUNTA_A,
          texto: 'x',
          tipo: 'VERDADERO_FALSO',
          imagen: null,
          opciones: [],
        },
      },
    ]);

    await service.examen(MODULO_ID);

    expect(prisma.moduloVersionPregunta.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          moduloVersionId: VERSION_ID,
          activa: true,
          pregunta: { activa: true },
        },
      }),
    );
  });

  // --- rendir -----------------------------------------------------------

  it('404 si la versión rendida no es de un módulo de demo', async () => {
    prisma.moduloVersion.findUnique.mockResolvedValue(
      versionDeDemo({ modulo: { id: MODULO_ID, demoPublico: false } }),
    );

    await expect(
      service.rendir('Juan', rendirUnaCorrecta),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.sesionInvitado.create).not.toHaveBeenCalled();
  });

  it('409 si la versión es un BORRADOR', async () => {
    prisma.moduloVersion.findUnique.mockResolvedValue(
      versionDeDemo({ estado: 'BORRADOR' }),
    );

    await expect(
      service.rendir('Juan', rendirUnaCorrecta),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('acepta una versión ARCHIVADO: lo que se rindió se rindió', async () => {
    prisma.moduloVersion.findUnique.mockResolvedValue(
      versionDeDemo({ estado: 'ARCHIVADO' }),
    );
    prisma.moduloVersionPregunta.findMany.mockResolvedValue([
      { preguntaId: PREGUNTA_A, pregunta: { respuestaCorrecta: 'Verdadero' } },
    ]);
    prisma.sesionInvitado.create.mockResolvedValue({
      id: 'sesion-1',
      correctas: 1,
      total: 1,
      porcentaje: 100,
      aprobada: true,
      umbralAprobacion: 70,
    });

    await expect(
      service.rendir('Juan', rendirUnaCorrecta),
    ).resolves.toMatchObject({ aprobada: true });
  });

  it('rechaza preguntas que no pertenecen a la versión', async () => {
    prisma.moduloVersion.findUnique.mockResolvedValue(versionDeDemo());
    prisma.moduloVersionPregunta.findMany.mockResolvedValue([]);

    await expect(
      service.rendir('Juan', rendirUnaCorrecta),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza preguntas repetidas en el mismo intento', async () => {
    prisma.moduloVersion.findUnique.mockResolvedValue(versionDeDemo());

    await expect(
      service.rendir('Juan', {
        ...rendirUnaCorrecta,
        respuestas: [
          { preguntaId: PREGUNTA_A, respuestaDada: 'Verdadero' },
          { preguntaId: PREGUNTA_A, respuestaDada: 'Falso' },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza iniciadaEn posterior a finalizadaEn', async () => {
    prisma.moduloVersion.findUnique.mockResolvedValue(versionDeDemo());

    await expect(
      service.rendir('Juan', {
        ...rendirUnaCorrecta,
        iniciadaEn: new Date('2026-09-01T11:00:00Z'),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  // El corazón del modo: el resultado lo calcula el BACKEND. Si lo decidiera la
  // app, el reporte de invitados no significaría nada.
  it('corrige con corregir.ts y persiste el nombre del TOKEN', async () => {
    prisma.moduloVersion.findUnique.mockResolvedValue(versionDeDemo());
    prisma.moduloVersionPregunta.findMany.mockResolvedValue([
      { preguntaId: PREGUNTA_A, pregunta: { respuestaCorrecta: 'Verdadero' } },
      { preguntaId: PREGUNTA_B, pregunta: { respuestaCorrecta: 'Verdadero' } },
    ]);
    prisma.sesionInvitado.create.mockResolvedValue({
      id: 'sesion-1',
      correctas: 1,
      total: 2,
      porcentaje: 50,
      aprobada: false,
      umbralAprobacion: 70,
    });

    await service.rendir('Juan Pérez', {
      moduloVersionId: VERSION_ID,
      finalizadaEn: new Date('2026-09-01T10:00:00Z'),
      respuestas: [
        { preguntaId: PREGUNTA_A, respuestaDada: 'Verdadero' },
        { preguntaId: PREGUNTA_B, respuestaDada: 'Falso' },
      ],
    });

    expect(prisma.sesionInvitado.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          nombre: 'Juan Pérez',
          moduloVersionId: VERSION_ID,
          correctas: 1,
          total: 2,
          porcentaje: 50,
          aprobada: false,
          // Sin umbral propio de la versión → el default global (70).
          umbralAprobacion: 70,
        }),
      }),
    );
  });

  it('usa el umbral que declara la versión y lo congela en la fila', async () => {
    prisma.moduloVersion.findUnique.mockResolvedValue(
      versionDeDemo({ umbralAprobacion: 50 }),
    );
    prisma.moduloVersionPregunta.findMany.mockResolvedValue([
      { preguntaId: PREGUNTA_A, pregunta: { respuestaCorrecta: 'Verdadero' } },
      { preguntaId: PREGUNTA_B, pregunta: { respuestaCorrecta: 'Verdadero' } },
    ]);
    prisma.sesionInvitado.create.mockResolvedValue({
      id: 'sesion-1',
      correctas: 1,
      total: 2,
      porcentaje: 50,
      aprobada: true,
      umbralAprobacion: 50,
    });

    await service.rendir('Ana', {
      moduloVersionId: VERSION_ID,
      finalizadaEn: new Date('2026-09-01T10:00:00Z'),
      respuestas: [
        { preguntaId: PREGUNTA_A, respuestaDada: 'Verdadero' },
        { preguntaId: PREGUNTA_B, respuestaDada: 'Falso' },
      ],
    });

    const data = prisma.sesionInvitado.create.mock.calls[0][0].data;
    // 50 % con umbral 50 aprueba; con el default global (70) no lo haría.
    expect(data).toMatchObject({ umbralAprobacion: 50, aprobada: true });
  });

  it('una respuesta en blanco cuenta como incorrecta, no como error', async () => {
    prisma.moduloVersion.findUnique.mockResolvedValue(versionDeDemo());
    prisma.moduloVersionPregunta.findMany.mockResolvedValue([
      { preguntaId: PREGUNTA_A, pregunta: { respuestaCorrecta: 'Verdadero' } },
    ]);
    prisma.sesionInvitado.create.mockResolvedValue({
      id: 'sesion-1',
      correctas: 0,
      total: 1,
      porcentaje: 0,
      aprobada: false,
      umbralAprobacion: 70,
    });

    await service.rendir('Ana', {
      moduloVersionId: VERSION_ID,
      finalizadaEn: new Date('2026-09-01T10:00:00Z'),
      respuestas: [{ preguntaId: PREGUNTA_A, respuestaDada: null }],
    });

    const data = prisma.sesionInvitado.create.mock.calls[0][0].data;
    expect(data.respuestas.create).toEqual([
      { preguntaId: PREGUNTA_A, respuestaDada: null, correcta: false },
    ]);
  });

  it('rechaza una pregunta sin respuesta correcta cargada', async () => {
    prisma.moduloVersion.findUnique.mockResolvedValue(versionDeDemo());
    prisma.moduloVersionPregunta.findMany.mockResolvedValue([
      { preguntaId: PREGUNTA_A, pregunta: { respuestaCorrecta: null } },
    ]);

    await expect(
      service.rendir('Ana', rendirUnaCorrecta),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  // Lo que NO hace, y es parte del diseño: la demo no toca la nómina.
  it('no escribe en sesiones reales ni toca asignaciones', async () => {
    prisma.moduloVersion.findUnique.mockResolvedValue(versionDeDemo());
    prisma.moduloVersionPregunta.findMany.mockResolvedValue([
      { preguntaId: PREGUNTA_A, pregunta: { respuestaCorrecta: 'Verdadero' } },
    ]);
    prisma.sesionInvitado.create.mockResolvedValue({
      id: 'sesion-1',
      correctas: 1,
      total: 1,
      porcentaje: 100,
      aprobada: true,
      umbralAprobacion: 70,
    });

    await service.rendir('Juan', rendirUnaCorrecta);

    // El mock de Prisma ni siquiera expone `sesion` o `asignacion`: si el
    // service los usara, este test explotaría con un TypeError.
    expect(prisma).not.toHaveProperty('sesion');
    expect(prisma).not.toHaveProperty('asignacion');
    expect(prisma.sesionInvitado.create).toHaveBeenCalledTimes(1);
  });
});
