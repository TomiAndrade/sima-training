import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { RegistrarSesionDto } from './dto/registrar-sesion.dto';
import { SesionesService } from './sesiones.service';

const VERSION = 'v-activa';
const MODULO = 'm1';
const [P1, P2, P3] = ['p1', 'p2', 'p3'];

// Pivot como lo lee registrar(): pertenencia a la versión + con qué corregir.
const pivot = (preguntaId: string, respuestaCorrecta: string | null = 'V') => ({
  preguntaId,
  pregunta: { respuestaCorrecta },
});

describe('SesionesService.registrar', () => {
  let service: SesionesService;
  let prisma: {
    usuario: { findFirst: jest.Mock };
    moduloVersion: { findUnique: jest.Mock };
    moduloVersionPregunta: { findMany: jest.Mock };
    asignacion: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    sesion: { create: jest.Mock };
    $transaction: jest.Mock;
  };

  // Payload base: 3 preguntas, todas contestadas bien.
  const dto = (
    respuestas: { preguntaId: string; respuestaDada?: string | null }[] = [
      { preguntaId: P1, respuestaDada: 'V' },
      { preguntaId: P2, respuestaDada: 'V' },
      { preguntaId: P3, respuestaDada: 'V' },
    ],
    extra: Partial<RegistrarSesionDto> = {},
  ): RegistrarSesionDto => ({
    usuarioId: 1,
    moduloVersionId: VERSION,
    finalizadaEn: new Date('2026-08-10T12:00:00Z'),
    respuestas,
    ...extra,
  });

  // Lo que el service le mandó a sesion.create, que es donde se ve el resultado
  // calculado por el backend.
  const dataCreada = () => prisma.sesion.create.mock.calls[0][0].data;

  beforeEach(async () => {
    prisma = {
      usuario: { findFirst: jest.fn() },
      moduloVersion: { findUnique: jest.fn() },
      moduloVersionPregunta: { findMany: jest.fn() },
      asignacion: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      sesion: { create: jest.fn() },
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    // Por defecto: usuario vivo, versión ACTIVA con las 3 preguntas, sin
    // asignación vigente (los tests que la necesitan la ponen).
    prisma.usuario.findFirst.mockResolvedValue({ id: 1 });
    prisma.moduloVersion.findUnique.mockResolvedValue({
      id: VERSION,
      moduloId: MODULO,
      estado: 'ACTIVO',
    });
    prisma.moduloVersionPregunta.findMany.mockResolvedValue([
      pivot(P1),
      pivot(P2),
      pivot(P3),
    ]);
    prisma.asignacion.findFirst.mockResolvedValue(null);
    prisma.sesion.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 's1', ...data }),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SesionesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(SesionesService);
  });

  // --- Aprobación -----------------------------------------------------------

  it('corrige, persiste el resultado y congela el umbral en la fila', async () => {
    await service.registrar(dto());

    expect(dataCreada()).toMatchObject({
      usuarioId: 1,
      moduloVersionId: VERSION,
      correctas: 3,
      total: 3,
      porcentaje: 100,
      aprobada: true,
      // Congelado: mostrar el resultado no vuelve a leer la constante.
      umbralAprobacion: 70,
    });
  });

  it('persiste una Respuesta por pregunta, con su corrección', async () => {
    await service.registrar(
      dto([
        { preguntaId: P1, respuestaDada: 'V' },
        { preguntaId: P2, respuestaDada: 'F' },
        { preguntaId: P3, respuestaDada: null },
      ]),
    );

    expect(dataCreada()).toMatchObject({
      correctas: 1,
      porcentaje: 33,
      aprobada: false,
    });
    expect(dataCreada().respuestas.create).toEqual([
      { preguntaId: P1, respuestaDada: 'V', correcta: true },
      { preguntaId: P2, respuestaDada: 'F', correcta: false },
      // Sin contestar entra como null, no como string vacío.
      { preguntaId: P3, respuestaDada: null, correcta: false },
    ]);
  });

  it('todo pasa por UNA transacción: la sesión y sus respuestas no se separan', async () => {
    await service.registrar(dto());
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  // --- El resultado lo manda el backend, no el cliente -----------------------

  it('ignora aprobada/porcentaje si se los cuelan en el payload', async () => {
    // La ValidationPipe los rechaza por HTTP (ver el describe de abajo); acá se
    // fija la segunda línea de defensa: el service nunca los lee.
    await service.registrar({
      ...dto([{ preguntaId: P1, respuestaDada: 'F' }]),
      aprobada: true,
      porcentaje: 100,
      correctas: 99,
    } as never);

    expect(dataCreada()).toMatchObject({
      correctas: 0,
      total: 1,
      porcentaje: 0,
      aprobada: false,
    });
  });

  // --- Asignacion.moduloVersionId ------------------------------------------

  it('al APROBAR completa Asignacion.moduloVersionId', async () => {
    prisma.asignacion.findFirst.mockResolvedValue({ id: 'a1' });

    await service.registrar(dto());

    expect(prisma.asignacion.update).toHaveBeenCalledWith({
      where: { id: 'a1' },
      data: expect.objectContaining({ moduloVersionId: VERSION }),
    });
  });

  it('al DESAPROBAR no lo toca: la obligación sigue sin cumplirse', async () => {
    prisma.asignacion.findFirst.mockResolvedValue({ id: 'a1' });

    await service.registrar(dto([{ preguntaId: P1, respuestaDada: 'F' }]));

    expect(dataCreada()).toMatchObject({ aprobada: false });
    expect(prisma.asignacion.update).not.toHaveBeenCalled();
  });

  it('aprobar NO revoca la asignación: sigue vigente, la regla la sigue pidiendo', async () => {
    prisma.asignacion.findFirst.mockResolvedValue({ id: 'a1' });

    await service.registrar(dto());

    // El único update es el de moduloVersionId; revocadaAt no se toca.
    expect(prisma.asignacion.update).toHaveBeenCalledTimes(1);
    expect(prisma.asignacion.update.mock.calls[0][0].data).not.toHaveProperty(
      'revocadaAt',
    );
  });

  it('ata la sesión a la asignación vigente aunque el cliente no la mande', async () => {
    prisma.asignacion.findFirst.mockResolvedValue({ id: 'a1' });

    await service.registrar(dto());

    expect(dataCreada().asignacionId).toBe('a1');
    expect(prisma.asignacion.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { usuarioId: 1, moduloId: MODULO, revocadaAt: null },
      }),
    );
  });

  it('rendir SIN asignación vigente vale igual', async () => {
    prisma.asignacion.findFirst.mockResolvedValue(null);

    await service.registrar(dto());

    expect(dataCreada()).toMatchObject({ asignacionId: null, aprobada: true });
    expect(prisma.asignacion.update).not.toHaveBeenCalled();
  });

  // --- Reintentos -----------------------------------------------------------

  it('el reintento tras desaprobar crea una SEGUNDA sesión, no pisa la anterior', async () => {
    prisma.asignacion.findFirst.mockResolvedValue({ id: 'a1' });

    // 1er intento: desaprueba.
    await service.registrar(dto([{ preguntaId: P1, respuestaDada: 'F' }]));
    expect(prisma.asignacion.update).not.toHaveBeenCalled();

    // 2do intento: aprueba. No hay update ni upsert de la sesión anterior — es
    // un create nuevo, porque no hay unicidad sobre (usuario, moduloVersion).
    await service.registrar(dto());

    expect(prisma.sesion.create).toHaveBeenCalledTimes(2);
    expect(prisma.sesion.create.mock.calls[0][0].data.aprobada).toBe(false);
    expect(prisma.sesion.create.mock.calls[1][0].data.aprobada).toBe(true);
    // Y recién la aprobación completa la asignación.
    expect(prisma.asignacion.update).toHaveBeenCalledTimes(1);
  });

  // --- Rechazos -------------------------------------------------------------

  it('rechaza un usuario inexistente o dado de baja', async () => {
    prisma.usuario.findFirst.mockResolvedValue(null);
    await expect(service.registrar(dto())).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.sesion.create).not.toHaveBeenCalled();
  });

  it('rechaza rendir un BORRADOR', async () => {
    prisma.moduloVersion.findUnique.mockResolvedValue({
      id: VERSION,
      moduloId: MODULO,
      estado: 'BORRADOR',
    });
    await expect(service.registrar(dto())).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.sesion.create).not.toHaveBeenCalled();
  });

  it('ACEPTA una versión ARCHIVADO: lo que se rindió, se rindió', async () => {
    // Con el modo offline, una sesión sincronizada tarde puede corresponder a una
    // versión que se archivó mientras tanto.
    prisma.moduloVersion.findUnique.mockResolvedValue({
      id: VERSION,
      moduloId: MODULO,
      estado: 'ARCHIVADO',
    });
    await expect(service.registrar(dto())).resolves.toMatchObject({
      aprobada: true,
    });
  });

  it('rechaza la misma pregunta dos veces en el mismo intento', async () => {
    await expect(
      service.registrar(
        dto([
          { preguntaId: P1, respuestaDada: 'V' },
          { preguntaId: P1, respuestaDada: 'F' },
        ]),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.sesion.create).not.toHaveBeenCalled();
  });

  it('rechaza una pregunta que no pertenece a la versión rendida', async () => {
    // El pivot de P3 no existe en esta versión.
    prisma.moduloVersionPregunta.findMany.mockResolvedValue([
      pivot(P1),
      pivot(P2),
    ]);
    await expect(service.registrar(dto())).rejects.toThrow(/no pertenecen/i);
    expect(prisma.sesion.create).not.toHaveBeenCalled();
  });

  it('NO exige que la pregunta siga activa: una baja posterior no invalida lo rendido', async () => {
    // El where del pivot no filtra por `activa` — se fija acá para que no se
    // "arregle" agregándolo.
    await service.registrar(dto());
    const where = prisma.moduloVersionPregunta.findMany.mock.calls[0][0].where;
    expect(where).not.toHaveProperty('activa');
    expect(where.pregunta).toBeUndefined();
  });

  it('rechaza una pregunta sin respuesta correcta cargada, en vez de puntuarla 0', async () => {
    prisma.moduloVersionPregunta.findMany.mockResolvedValue([
      pivot(P1),
      pivot(P2),
      pivot(P3, null),
    ]);
    await expect(service.registrar(dto())).rejects.toThrow(
      /no se pueden corregir autom/i,
    );
    expect(prisma.sesion.create).not.toHaveBeenCalled();
  });

  it('rechaza iniciadaEn posterior a finalizadaEn', async () => {
    await expect(
      service.registrar(
        dto(undefined, { iniciadaEn: new Date('2026-08-10T13:00:00Z') }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza una asignación de otra persona, de otro módulo o revocada', async () => {
    const conAsignacion = () => dto(undefined, { asignacionId: 'a1' });

    prisma.asignacion.findUnique.mockResolvedValue(null);
    await expect(service.registrar(conAsignacion())).rejects.toBeInstanceOf(
      NotFoundException,
    );

    prisma.asignacion.findUnique.mockResolvedValue({
      id: 'a1',
      usuarioId: 999,
      moduloId: MODULO,
      revocadaAt: null,
    });
    await expect(service.registrar(conAsignacion())).rejects.toThrow(
      /de otra persona/i,
    );

    prisma.asignacion.findUnique.mockResolvedValue({
      id: 'a1',
      usuarioId: 1,
      moduloId: 'otro-modulo',
      revocadaAt: null,
    });
    await expect(service.registrar(conAsignacion())).rejects.toThrow(
      /de otro módulo/i,
    );

    prisma.asignacion.findUnique.mockResolvedValue({
      id: 'a1',
      usuarioId: 1,
      moduloId: MODULO,
      revocadaAt: new Date(),
    });
    await expect(service.registrar(conAsignacion())).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(prisma.sesion.create).not.toHaveBeenCalled();
  });
});

// La otra mitad de "el backend manda sobre el resultado": que el payload ni
// siquiera entre. Se ejercita la pipe instanciada a mano con la MISMA config de
// main.ts, porque esta story todavía no tiene controller donde probarla por HTTP
// (los endpoints son la Story 5).
describe('RegistrarSesionDto contra la ValidationPipe de main.ts', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });
  const metadata = {
    type: 'body' as const,
    metatype: RegistrarSesionDto,
  };
  const valido = {
    usuarioId: 1,
    moduloVersionId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    finalizadaEn: '2026-08-10T12:00:00.000Z',
    respuestas: [
      {
        preguntaId: '3fa85f64-5717-4562-b3fc-2c963f66afa7',
        respuestaDada: 'V',
      },
    ],
  };

  // La pipe tira BadRequestException con los motivos en getResponse().message,
  // no en el mensaje del Error — que es siempre "Bad Request Exception".
  const motivosDelRechazo = async (payload: unknown): Promise<string[]> => {
    let rechazo: unknown;
    try {
      await pipe.transform(payload, metadata);
    } catch (err) {
      rechazo = err;
    }
    expect(rechazo).toBeInstanceOf(BadRequestException);
    const respuesta = (rechazo as BadRequestException).getResponse();
    const mensajes = (respuesta as { message: string | string[] }).message;
    return Array.isArray(mensajes) ? mensajes : [String(mensajes)];
  };

  it('acepta un payload de respuestas crudas', async () => {
    const salida = (await pipe.transform(
      valido,
      metadata,
    )) as RegistrarSesionDto;
    expect(salida.finalizadaEn).toBeInstanceOf(Date);
    expect(salida.respuestas[0].respuestaDada).toBe('V');
  });

  it('RECHAZA (400) un payload que trae aprobada, porcentaje o el umbral', async () => {
    // Sin forbidNonWhitelisted esto sería un descarte silencioso; con él, es un
    // 400. Es lo que impide que alguien con curl se apruebe todos los módulos.
    expect(await motivosDelRechazo({ ...valido, aprobada: true })).toContain(
      'property aprobada should not exist',
    );
    expect(await motivosDelRechazo({ ...valido, porcentaje: 100 })).toContain(
      'property porcentaje should not exist',
    );
    expect(
      await motivosDelRechazo({ ...valido, umbralAprobacion: 0 }),
    ).toContain('property umbralAprobacion should not exist');
  });

  it('el rechazo alcanza también a los items de respuestas[]', async () => {
    // Esto es lo que compra el @ValidateNested({each:true}) + @Type(): sin ellos
    // la pipe no entra al array y un item podría colar `correcta`.
    const motivos = await motivosDelRechazo({
      ...valido,
      respuestas: [{ ...valido.respuestas[0], correcta: true }],
    });
    expect(motivos.join(' ')).toMatch(/correcta should not exist/);
  });

  it('rechaza una rendición sin respuestas', async () => {
    const motivos = await motivosDelRechazo({ ...valido, respuestas: [] });
    expect(motivos.join(' ')).toMatch(/respuestas should not be empty/);
  });
});
