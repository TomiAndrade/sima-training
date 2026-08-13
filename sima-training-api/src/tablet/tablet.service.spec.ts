import {
  ConflictException,
  NotFoundException,
  NotImplementedException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { AsignacionesService } from '../asignaciones/asignaciones.service';
import { PrismaService } from '../prisma/prisma.service';
import { SesionesService } from '../sesiones/sesiones.service';
import { PREGUNTAS_POR_EXAMEN, TabletService } from './tablet.service';

// El alumno logueado en la tablet. Importa porque examen() ya no es impersonal:
// los intentos gastados se cuentan contra esta persona.
const ALUMNO = 7;

describe('TabletService', () => {
  let service: TabletService;
  let prisma: {
    usuario: { findFirst: jest.Mock };
    asignacion: { findMany: jest.Mock };
    modulo: { findUnique: jest.Mock };
    moduloVersion: { findUnique: jest.Mock };
    moduloVersionPregunta: { findMany: jest.Mock };
    sesion: { findMany: jest.Mock };
  };
  let jwt: { sign: jest.Mock };
  let config: { get: jest.Mock };
  let asignaciones: { modulosAprobados: jest.Mock };
  let sesiones: { registrar: jest.Mock };

  beforeEach(async () => {
    prisma = {
      usuario: { findFirst: jest.fn() },
      asignacion: { findMany: jest.fn() },
      modulo: { findUnique: jest.fn() },
      moduloVersion: { findUnique: jest.fn() },
      moduloVersionPregunta: { findMany: jest.fn() },
      // Sin intentos previos por defecto: los tests de reintentos lo pisan.
      sesion: { findMany: jest.fn().mockResolvedValue([]) },
    };
    jwt = { sign: jest.fn().mockReturnValue('fake.jwt.token') };
    // Sin TABLET_LOGIN_SIN_PIN configurada = default 'true' (login sin PIN
    // habilitado); los tests que necesitan el otro valor lo pisan.
    config = { get: jest.fn().mockReturnValue(undefined) };
    asignaciones = { modulosAprobados: jest.fn().mockResolvedValue(new Set()) };
    sesiones = { registrar: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TabletService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: config },
        { provide: AsignacionesService, useValue: asignaciones },
        { provide: SesionesService, useValue: sesiones },
      ],
    }).compile();

    service = module.get(TabletService);
  });

  // --- login ------------------------------------------------------------

  it('rechaza un DNI inexistente', async () => {
    prisma.usuario.findFirst.mockResolvedValue(null);
    await expect(service.login({ dni: '99999999' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(jwt.sign).not.toHaveBeenCalled();
  });

  it('un usuario dado de baja se trata como inexistente: el where filtra deletedAt: null', async () => {
    prisma.usuario.findFirst.mockResolvedValue(null);
    await expect(service.login({ dni: '11111111' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.usuario.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { dni: '11111111', deletedAt: null },
      }),
    );
  });

  it('un DNI válido devuelve un token firmado con tipo alumno', async () => {
    prisma.usuario.findFirst.mockResolvedValue({
      id: 7,
      nombre: 'Carlos',
      apellido: 'Ferreyra',
    });

    const res = await service.login({ dni: '22222222' });

    expect(jwt.sign).toHaveBeenCalledWith(
      { sub: 7, tipo: 'alumno' },
      expect.objectContaining({ expiresIn: expect.any(String) }),
    );
    expect(res).toMatchObject({
      access_token: 'fake.jwt.token',
      usuario: { id: 7, nombre: 'Carlos', apellido: 'Ferreyra' },
    });
  });

  it('responde 501 si TABLET_LOGIN_SIN_PIN está en false', async () => {
    config.get.mockImplementation((key: string) =>
      key === 'TABLET_LOGIN_SIN_PIN' ? 'false' : undefined,
    );

    await expect(service.login({ dni: '22222222' })).rejects.toBeInstanceOf(
      NotImplementedException,
    );
    expect(prisma.usuario.findFirst).not.toHaveBeenCalled();
  });

  // --- pendientes ---------------------------------------------------------

  const asignacionRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'asig-1',
    moduloId: 'mod-1',
    modulo: {
      nombre: 'SIMA Básico',
      descripcion: 'Módulo base',
      activo: true,
      versiones: [{ id: 'v1', anio: 2026, mayor: 1, menor: 0 }],
    },
    ...overrides,
  });

  it('devuelve el caso normal con la forma esperada', async () => {
    prisma.asignacion.findMany.mockResolvedValue([asignacionRow()]);

    const res = await service.pendientes(7);

    expect(res).toEqual([
      {
        asignacionId: 'asig-1',
        moduloId: 'mod-1',
        nombre: 'SIMA Básico',
        descripcion: 'Módulo base',
        version: { id: 'v1', anio: 2026, mayor: 1, menor: 0 },
        // Cada pendiente viaja con su estado de reintentos para que la app
        // pueda deshabilitar el botón con el motivo, en vez de dejar tocar y
        // comerse un 409 recién ahí.
        reintentos: {
          puedeRendir: true,
          motivo: 'OK',
          intentosUsados: 0,
          intentosRestantes: null,
          proximoIntentoEn: null,
        },
      },
    ]);
  });

  it('el pendiente informa la espera pendiente sin sacarlo de la lista', async () => {
    prisma.asignacion.findMany.mockResolvedValue([
      asignacionRow({
        modulo: {
          nombre: 'SIMA Básico',
          descripcion: 'Módulo base',
          activo: true,
          versiones: [
            {
              id: 'v1',
              anio: 2026,
              mayor: 1,
              menor: 0,
              esperaEntreIntentosMinutos: 60,
            },
          ],
        },
      }),
    ]);
    prisma.sesion.findMany.mockResolvedValue([
      {
        // Recién rendida: la espera todavía corre.
        finalizadaEn: new Date(Date.now() - 10 * 60_000),
        aprobada: false,
        moduloVersion: { moduloId: 'mod-1' },
      },
    ]);

    const [pendiente] = await service.pendientes(7);

    // Sigue listado (la obligación no desapareció), pero con el motivo.
    expect(pendiente.reintentos).toMatchObject({
      puedeRendir: false,
      motivo: 'EN_ESPERA',
      intentosUsados: 1,
    });
    expect(pendiente.reintentos.proximoIntentoEn).toBeInstanceOf(Date);
  });

  it('excluye módulos ya aprobados', async () => {
    prisma.asignacion.findMany.mockResolvedValue([asignacionRow()]);
    asignaciones.modulosAprobados.mockResolvedValue(new Set(['mod-1']));

    expect(await service.pendientes(7)).toEqual([]);
  });

  it('excluye un módulo sin ninguna versión ACTIVO', async () => {
    prisma.asignacion.findMany.mockResolvedValue([
      asignacionRow({
        modulo: {
          nombre: 'SIMA Básico',
          descripcion: 'Módulo base',
          activo: true,
          versiones: [],
        },
      }),
    ]);

    expect(await service.pendientes(7)).toEqual([]);
  });

  it('excluye un módulo dado de baja (activo: false)', async () => {
    prisma.asignacion.findMany.mockResolvedValue([
      asignacionRow({
        modulo: {
          nombre: 'SIMA Básico',
          descripcion: 'Módulo base',
          activo: false,
          versiones: [{ id: 'v1', anio: 2026, mayor: 1, menor: 0 }],
        },
      }),
    ]);

    expect(await service.pendientes(7)).toEqual([]);
  });

  it('un usuario sin asignaciones devuelve un array vacío, no un error', async () => {
    prisma.asignacion.findMany.mockResolvedValue([]);
    await expect(service.pendientes(7)).resolves.toEqual([]);
  });

  // --- examen ---------------------------------------------------------------

  const moduloRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'mod-1',
    nombre: 'SIMA Básico',
    descripcion: 'Módulo base',
    activo: true,
    versiones: [{ id: 'v1', anio: 2026, mayor: 1, menor: 0 }],
    ...overrides,
  });

  const preguntaRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'p1',
    texto: '¿Usa arnés?',
    tipo: 'VERDADERO_FALSO',
    imagen: null,
    opciones: ['Verdadero', 'Falso'],
    ...overrides,
  });

  const mockPivots = (preguntas: Record<string, unknown>[]) =>
    prisma.moduloVersionPregunta.findMany.mockResolvedValue(
      preguntas.map((pregunta) => ({ pregunta })),
    );

  it('rechaza un módulo inexistente', async () => {
    prisma.modulo.findUnique.mockResolvedValue(null);
    await expect(service.examen(ALUMNO, 'mod-x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rechaza un módulo dado de baja (activo: false)', async () => {
    prisma.modulo.findUnique.mockResolvedValue(moduloRow({ activo: false }));
    await expect(service.examen(ALUMNO, 'mod-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rechaza un módulo sin versión ACTIVO', async () => {
    prisma.modulo.findUnique.mockResolvedValue(moduloRow({ versiones: [] }));
    await expect(service.examen(ALUMNO, 'mod-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.moduloVersionPregunta.findMany).not.toHaveBeenCalled();
  });

  it('devuelve exactamente PREGUNTAS_POR_EXAMEN preguntas cuando hay más', async () => {
    prisma.modulo.findUnique.mockResolvedValue(moduloRow());
    mockPivots([
      preguntaRow({ id: 'p1' }),
      preguntaRow({ id: 'p2' }),
      preguntaRow({ id: 'p3' }),
      preguntaRow({ id: 'p4' }),
      preguntaRow({ id: 'p5' }),
    ]);

    const res = await service.examen(ALUMNO, 'mod-1');

    expect(res.preguntas).toHaveLength(3);
  });

  it('devuelve las que haya cuando hay menos de PREGUNTAS_POR_EXAMEN', async () => {
    prisma.modulo.findUnique.mockResolvedValue(moduloRow());
    mockPivots([preguntaRow({ id: 'p1' }), preguntaRow({ id: 'p2' })]);

    const res = await service.examen(ALUMNO, 'mod-1');

    expect(res.preguntas).toHaveLength(2);
  });

  it('sortea la cantidad que declara la versión, no el default', async () => {
    prisma.modulo.findUnique.mockResolvedValue(
      moduloRow({
        versiones: [
          { id: 'v1', anio: 2026, mayor: 1, menor: 0, preguntasPorExamen: 5 },
        ],
      }),
    );
    mockPivots(
      Array.from({ length: 8 }, (_, i) => preguntaRow({ id: `p${i + 1}` })),
    );

    const res = await service.examen(ALUMNO, 'mod-1');

    expect(res.preguntas).toHaveLength(5);
  });

  it('cae al default cuando la versión no declara cantidad (null)', async () => {
    // `null` es "sin declarar", NO cero: una versión publicada antes de que la
    // columna existiera tiene que seguir sirviendo un examen de 3, no uno vacío.
    prisma.modulo.findUnique.mockResolvedValue(
      moduloRow({
        versiones: [
          {
            id: 'v1',
            anio: 2026,
            mayor: 1,
            menor: 0,
            preguntasPorExamen: null,
          },
        ],
      }),
    );
    mockPivots(
      Array.from({ length: 8 }, (_, i) => preguntaRow({ id: `p${i + 1}` })),
    );

    const res = await service.examen(ALUMNO, 'mod-1');

    expect(res.preguntas).toHaveLength(PREGUNTAS_POR_EXAMEN);
  });

  it('rechaza el examen si la persona agotó sus intentos', async () => {
    prisma.modulo.findUnique.mockResolvedValue(
      moduloRow({
        versiones: [
          { id: 'v1', anio: 2026, mayor: 1, menor: 0, maxIntentos: 2 },
        ],
      }),
    );
    prisma.sesion.findMany.mockResolvedValue([
      {
        finalizadaEn: new Date('2026-08-01T10:00:00Z'),
        aprobada: false,
        moduloVersion: { moduloId: 'mod-1' },
      },
      {
        finalizadaEn: new Date('2026-08-02T10:00:00Z'),
        aprobada: false,
        moduloVersion: { moduloId: 'mod-1' },
      },
    ]);

    await expect(service.examen(ALUMNO, 'mod-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    // El corte va ANTES de armar el pool: no se gasta la query de pivots en
    // alguien que no puede rendir.
    expect(prisma.moduloVersionPregunta.findMany).not.toHaveBeenCalled();
  });

  it('los intentos se cuentan por MÓDULO, no por versión', async () => {
    prisma.modulo.findUnique.mockResolvedValue(moduloRow());
    mockPivots([preguntaRow()]);

    await service.examen(ALUMNO, 'mod-1');

    // Publicar una versión nueva no le devuelve intentos a nadie: el where
    // atraviesa la versión hasta el módulo.
    expect(prisma.sesion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          usuarioId: ALUMNO,
          moduloVersion: { moduloId: { in: ['mod-1'] } },
        },
      }),
    );
  });

  it('una aprobación previa devuelve los intentos: la recertificación arranca limpia', async () => {
    prisma.modulo.findUnique.mockResolvedValue(
      moduloRow({
        versiones: [
          { id: 'v1', anio: 2026, mayor: 1, menor: 0, maxIntentos: 2 },
        ],
      }),
    );
    prisma.sesion.findMany.mockResolvedValue([
      {
        finalizadaEn: new Date('2026-01-01T10:00:00Z'),
        aprobada: false,
        moduloVersion: { moduloId: 'mod-1' },
      },
      {
        finalizadaEn: new Date('2026-01-02T10:00:00Z'),
        aprobada: false,
        moduloVersion: { moduloId: 'mod-1' },
      },
      // Aprobó después de gastar los dos: el contador vuelve a cero.
      {
        finalizadaEn: new Date('2026-01-03T10:00:00Z'),
        aprobada: true,
        moduloVersion: { moduloId: 'mod-1' },
      },
    ]);
    mockPivots([preguntaRow()]);

    await expect(service.examen(ALUMNO, 'mod-1')).resolves.toMatchObject({
      moduloId: 'mod-1',
    });
  });

  it('sin parámetros declarados el examen se sirve como siempre', async () => {
    prisma.modulo.findUnique.mockResolvedValue(moduloRow());
    prisma.sesion.findMany.mockResolvedValue(
      // 5 intentos previos, ninguno aprobado: sin tope, no bloquea nada.
      Array.from({ length: 5 }, (_, i) => ({
        finalizadaEn: new Date(`2026-08-0${i + 1}T10:00:00Z`),
        aprobada: false,
        moduloVersion: { moduloId: 'mod-1' },
      })),
    );
    mockPivots([preguntaRow()]);

    await expect(service.examen(ALUMNO, 'mod-1')).resolves.toMatchObject({
      moduloId: 'mod-1',
    });
  });

  it('rechaza con Conflict un módulo sin ninguna pregunta activa', async () => {
    prisma.modulo.findUnique.mockResolvedValue(moduloRow());
    mockPivots([]);

    await expect(service.examen(ALUMNO, 'mod-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('el where del sorteo excluye pivots inactivos y preguntas en papelera global', async () => {
    prisma.modulo.findUnique.mockResolvedValue(moduloRow());
    mockPivots([preguntaRow()]);

    await service.examen(ALUMNO, 'mod-1');

    expect(prisma.moduloVersionPregunta.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          moduloVersionId: 'v1',
          activa: true,
          pregunta: { activa: true },
        },
      }),
    );
  });

  it('respuestaCorrecta nunca aparece en el JSON servido, ni aunque el objeto la traiga colada', async () => {
    prisma.modulo.findUnique.mockResolvedValue(moduloRow());
    // Simula un select mal armado que trajera el campo de más: la garantía
    // tiene que sostenerse igual en la serialización, no sólo en el select.
    mockPivots([
      preguntaRow({ respuestaCorrecta: 'SECRETO-QUE-NO-DEBE-VIAJAR' }),
    ]);

    const res = await service.examen(ALUMNO, 'mod-1');

    expect(JSON.stringify(res)).not.toContain('SECRETO-QUE-NO-DEBE-VIAJAR');
  });

  it('OPCIONES_IMAGEN devuelve { clave, url } con la url prefijada', async () => {
    prisma.modulo.findUnique.mockResolvedValue(moduloRow());
    mockPivots([
      preguntaRow({
        tipo: 'OPCIONES_IMAGEN',
        imagen: 'preguntas/enunciado.png',
        opciones: ['preguntas/a.png', 'preguntas/b.png'],
      }),
    ]);

    const res = await service.examen(ALUMNO, 'mod-1');

    expect(res.preguntas[0].imagen).toEqual({
      clave: 'preguntas/enunciado.png',
      url: '/uploads/preguntas/enunciado.png',
    });
    expect(res.preguntas[0].opciones).toEqual([
      { clave: 'preguntas/a.png', url: '/uploads/preguntas/a.png' },
      { clave: 'preguntas/b.png', url: '/uploads/preguntas/b.png' },
    ]);
  });

  it("una ruta legacy ('/images/x.png') se devuelve sin prefijar", async () => {
    prisma.modulo.findUnique.mockResolvedValue(moduloRow());
    mockPivots([preguntaRow({ imagen: '/images/cartel.png' })]);

    const res = await service.examen(ALUMNO, 'mod-1');

    expect(res.preguntas[0].imagen).toEqual({
      clave: '/images/cartel.png',
      url: '/images/cartel.png',
    });
  });

  // --- rendir -----------------------------------------------------------

  const dtoRendicion = {
    moduloVersionId: 'v1',
    finalizadaEn: new Date('2026-08-10T12:00:00Z'),
    respuestas: [{ preguntaId: 'p1', respuestaDada: 'V' }],
  };

  const sesionRow = (overrides: Record<string, unknown> = {}) => ({
    id: 's1',
    correctas: 3,
    total: 3,
    porcentaje: 100,
    aprobada: true,
    umbralAprobacion: 70,
    duplicada: false,
    // Campos que SesionesService.registrar() sí devuelve pero que rendir()
    // NO debe reenviar a la tablet — ver el spec de abajo.
    respuestas: [{ preguntaId: 'p1', correcta: true, respuestaDada: 'V' }],
    ...overrides,
  });

  it('delega en SesionesService.registrar con el usuarioId del TOKEN, no el del dto', async () => {
    sesiones.registrar.mockResolvedValue(sesionRow());

    await service.rendir(7, dtoRendicion as never);

    expect(sesiones.registrar).toHaveBeenCalledWith({
      ...dtoRendicion,
      usuarioId: 7,
    });
  });

  it('el happy path no reenvía `respuestas` ni ningún campo de más', async () => {
    sesiones.registrar.mockResolvedValue(sesionRow());
    prisma.moduloVersion.findUnique.mockResolvedValue({
      moduloId: 'mod-1',
      modulo: { versiones: [{ maxIntentos: 3 }] },
    });
    prisma.sesion.findMany.mockResolvedValue([
      {
        finalizadaEn: new Date('2026-08-13T10:00:00Z'),
        aprobada: true,
        moduloVersion: { moduloId: 'mod-1' },
      },
    ]);

    const res = await service.rendir(7, dtoRendicion as never);

    expect(res.resultado).toEqual({
      sesionId: 's1',
      correctas: 3,
      total: 3,
      porcentaje: 100,
      aprobada: true,
      umbralAprobacion: 70,
      // Aprobó: el contador se reseteó y vuelve con los 3 intentos enteros.
      // Lo que la saca de pendientes es la aprobación, no el tope.
      reintentos: {
        puedeRendir: true,
        motivo: 'OK',
        intentosUsados: 0,
        intentosRestantes: 3,
        proximoIntentoEn: null,
      },
    });
    expect(res.resultado).not.toHaveProperty('respuestas');
  });

  it('el resultado dice que ya no quedan intentos tras desaprobar el último', async () => {
    sesiones.registrar.mockResolvedValue(
      sesionRow({ aprobada: false, porcentaje: 33, correctas: 1 }),
    );
    prisma.moduloVersion.findUnique.mockResolvedValue({
      moduloId: 'mod-1',
      modulo: { versiones: [{ maxIntentos: 2 }] },
    });
    prisma.sesion.findMany.mockResolvedValue([
      {
        finalizadaEn: new Date('2026-08-12T10:00:00Z'),
        aprobada: false,
        moduloVersion: { moduloId: 'mod-1' },
      },
      {
        finalizadaEn: new Date('2026-08-13T10:00:00Z'),
        aprobada: false,
        moduloVersion: { moduloId: 'mod-1' },
      },
    ]);

    const res = await service.rendir(7, dtoRendicion as never);

    // La pantalla de Resultado usa esto para no ofrecer "Reintentar".
    expect(res.resultado.reintentos).toMatchObject({
      puedeRendir: false,
      motivo: 'SIN_INTENTOS',
      intentosRestantes: 0,
    });
  });

  it('propaga `duplicada` tal cual lo devuelve SesionesService.registrar', async () => {
    sesiones.registrar.mockResolvedValue(sesionRow({ duplicada: true }));

    const res = await service.rendir(7, dtoRendicion as never);

    expect(res.duplicada).toBe(true);
  });
});
