import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AsignacionesService } from './asignaciones.service';

// Par (puesto, centro) como lo devuelve vinculacionPuestoCentro.findMany.
const par = (puestoId: string, centroCostoId: string) => ({
  puestoId,
  centroCostoId,
});

// Asignación vigente como la lee recalcular (select id/moduloId/origen).
const vigente = (
  id: string,
  moduloId: string,
  origen: 'AUTOMATICA' | 'MANUAL',
) => ({ id, moduloId, origen });

// Sesión aprobada como la lee modulosAprobados: entra por moduloVersionId y sale
// por moduloId (aprobar CUALQUIER versión cubre el módulo).
const sesionAprobadaDe = (moduloId: string) => ({
  moduloVersion: { moduloId },
});

describe('AsignacionesService.recalcular', () => {
  let service: AsignacionesService;
  let prisma: {
    usuario: { findFirst: jest.Mock };
    vinculacionPuestoCentro: { findMany: jest.Mock };
    reglaAsignacion: { findMany: jest.Mock };
    asignacion: {
      findMany: jest.Mock;
      createMany: jest.Mock;
      updateMany: jest.Mock;
    };
    sesion: { findMany: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      usuario: { findFirst: jest.fn() },
      vinculacionPuestoCentro: { findMany: jest.fn() },
      reglaAsignacion: { findMany: jest.fn() },
      asignacion: {
        findMany: jest.fn(),
        createMany: jest.fn(),
        updateMany: jest.fn(),
      },
      sesion: { findMany: jest.fn() },
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    // Por defecto: usuario existe, sin vigentes previas y sin nada aprobado.
    prisma.usuario.findFirst.mockResolvedValue({ id: 1 });
    prisma.asignacion.findMany.mockResolvedValue([]);
    prisma.sesion.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AsignacionesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(AsignacionesService);
  });

  it('crea la unión de módulos de todos los pares', async () => {
    prisma.vinculacionPuestoCentro.findMany.mockResolvedValue([
      par('p-soldador', 'c-ypf'),
      par('p-amolador', 'c-pae'),
    ]);
    // Un par pide m1, el otro m2.
    prisma.reglaAsignacion.findMany.mockResolvedValue([
      { moduloId: 'm1' },
      { moduloId: 'm2' },
    ]);
    prisma.asignacion.createMany.mockResolvedValue({ count: 2 });

    const res = await service.recalcular(1);

    expect(res).toEqual({ creadas: 2, revocadas: 0 });
    expect(prisma.asignacion.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          usuarioId: 1,
          moduloId: 'm1',
          origen: 'AUTOMATICA',
        }),
        expect.objectContaining({
          usuarioId: 1,
          moduloId: 'm2',
          origen: 'AUTOMATICA',
        }),
      ],
    });
    expect(prisma.asignacion.updateMany).not.toHaveBeenCalled();
  });

  it('un módulo pedido por dos pares es una sola asignación', async () => {
    prisma.vinculacionPuestoCentro.findMany.mockResolvedValue([
      par('p-soldador', 'c-ypf'),
      par('p-soldador', 'c-pae'),
    ]);
    // Los dos pares piden el MISMO módulo.
    prisma.reglaAsignacion.findMany.mockResolvedValue([
      { moduloId: 'm1' },
      { moduloId: 'm1' },
    ]);
    prisma.asignacion.createMany.mockResolvedValue({ count: 1 });

    const res = await service.recalcular(1);

    expect(res).toEqual({ creadas: 1, revocadas: 0 });
    expect(prisma.asignacion.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ moduloId: 'm1' })],
    });
  });

  it('revoca la AUTOMATICA cuando se le saca el par que la pedía', async () => {
    // La persona ya no tiene pares activos → nada requerido.
    prisma.vinculacionPuestoCentro.findMany.mockResolvedValue([]);
    prisma.asignacion.findMany.mockResolvedValue([
      vigente('a1', 'm1', 'AUTOMATICA'),
    ]);
    prisma.asignacion.updateMany.mockResolvedValue({ count: 1 });

    const res = await service.recalcular(1);

    expect(res).toEqual({ creadas: 0, revocadas: 1 });
    expect(prisma.asignacion.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['a1'] } },
      data: expect.objectContaining({ revocadaAt: expect.any(Date) }),
    });
    expect(prisma.asignacion.createMany).not.toHaveBeenCalled();
    // Sin pares no se consultan reglas (evita un OR: []).
    expect(prisma.reglaAsignacion.findMany).not.toHaveBeenCalled();
  });

  it('nunca revoca ni duplica una asignación MANUAL', async () => {
    prisma.vinculacionPuestoCentro.findMany.mockResolvedValue([
      par('p-soldador', 'c-ypf'),
    ]);
    prisma.reglaAsignacion.findMany.mockResolvedValue([{ moduloId: 'm1' }]);
    // Ya existe una MANUAL vigente del mismo módulo requerido.
    prisma.asignacion.findMany.mockResolvedValue([
      vigente('a1', 'm1', 'MANUAL'),
    ]);

    const res = await service.recalcular(1);

    // No la duplica (ya cubierto) ni la revoca (es MANUAL).
    expect(res).toEqual({ creadas: 0, revocadas: 0 });
    expect(prisma.asignacion.createMany).not.toHaveBeenCalled();
    expect(prisma.asignacion.updateMany).not.toHaveBeenCalled();
  });

  it('es idempotente: en régimen no crea ni revoca nada', async () => {
    prisma.vinculacionPuestoCentro.findMany.mockResolvedValue([
      par('p-soldador', 'c-ypf'),
    ]);
    prisma.reglaAsignacion.findMany.mockResolvedValue([{ moduloId: 'm1' }]);
    // El módulo requerido ya tiene su AUTOMATICA vigente.
    prisma.asignacion.findMany.mockResolvedValue([
      vigente('a1', 'm1', 'AUTOMATICA'),
    ]);

    const res = await service.recalcular(1);

    expect(res).toEqual({ creadas: 0, revocadas: 0 });
    // recalcular() público envuelve todo en una transacción (para que reads +
    // writes sean atómicos), así que $transaction se llama aunque no haya nada
    // que escribir. Lo idempotente es que no cree ni revoque.
    expect(prisma.asignacion.createMany).not.toHaveBeenCalled();
    expect(prisma.asignacion.updateMany).not.toHaveBeenCalled();
  });

  it('recalcularEnTx corre sobre el cliente provisto sin abrir otra transacción', async () => {
    // Camino embebido: el ABM de usuarios ya está dentro de una transacción y
    // pasa su `tx`; recalcularEnTx NO debe abrir una anidada.
    prisma.vinculacionPuestoCentro.findMany.mockResolvedValue([]);
    prisma.asignacion.findMany.mockResolvedValue([
      vigente('a1', 'm1', 'AUTOMATICA'),
    ]);
    prisma.asignacion.updateMany.mockResolvedValue({ count: 1 });

    const res = await service.recalcularEnTx(
      prisma as unknown as Prisma.TransactionClient,
      1,
    );

    expect(res).toEqual({ creadas: 0, revocadas: 1 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('lanza NotFound si el usuario no existe o está dado de baja', async () => {
    prisma.usuario.findFirst.mockResolvedValue(null);
    await expect(service.recalcular(99)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.vinculacionPuestoCentro.findMany).not.toHaveBeenCalled();
  });

  it('no re-asigna un módulo ya aprobado, pero no revoca su AUTOMATICA si un par lo sigue pidiendo', async () => {
    // m1 ya aprobado; m1 y m2 requeridos por los pares; m1 ya tiene AUTOMATICA.
    // Se maneja por el mock de `sesion` y no espiando modulosAprobados: así el
    // test ejercita la query de verdad (incluido el join a moduloVersion).
    prisma.sesion.findMany.mockResolvedValue([sesionAprobadaDe('m1')]);
    prisma.vinculacionPuestoCentro.findMany.mockResolvedValue([
      par('p-soldador', 'c-ypf'),
    ]);
    prisma.reglaAsignacion.findMany.mockResolvedValue([
      { moduloId: 'm1' },
      { moduloId: 'm2' },
    ]);
    prisma.asignacion.findMany.mockResolvedValue([
      vigente('a1', 'm1', 'AUTOMATICA'),
    ]);
    prisma.asignacion.createMany.mockResolvedValue({ count: 1 });

    const res = await service.recalcular(1);

    // Sólo se crea m2 (m1 está aprobado → no se re-asigna). m1 sigue requerido
    // por el par, así que su AUTOMATICA no se revoca.
    expect(res).toEqual({ creadas: 1, revocadas: 0 });
    expect(prisma.asignacion.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ moduloId: 'm2' })],
    });
    expect(prisma.asignacion.updateMany).not.toHaveBeenCalled();
  });

  it('sólo cuentan las sesiones APROBADAS: haber rendido y desaprobado no exime', async () => {
    // El where filtra por aprobada: true, así que la sesión fallida no llega acá —
    // se maneja el resultado de la query, y se fija el filtro contra el llamado.
    prisma.sesion.findMany.mockResolvedValue([]);
    prisma.vinculacionPuestoCentro.findMany.mockResolvedValue([
      par('p-soldador', 'c-ypf'),
    ]);
    prisma.reglaAsignacion.findMany.mockResolvedValue([{ moduloId: 'm1' }]);
    prisma.asignacion.createMany.mockResolvedValue({ count: 1 });

    const res = await service.recalcular(1);

    // Sin aprobación, el módulo se sigue asignando.
    expect(res).toEqual({ creadas: 1, revocadas: 0 });
    expect(prisma.sesion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { usuarioId: 1, aprobada: true } }),
    );
  });

  it('aprobar CUALQUIER versión cubre el módulo entero', async () => {
    // La sesión es de una versión vieja (ya archivada); la obligación es "este
    // módulo", así que igual lo cubre.
    prisma.sesion.findMany.mockResolvedValue([sesionAprobadaDe('m1')]);
    prisma.vinculacionPuestoCentro.findMany.mockResolvedValue([
      par('p-soldador', 'c-ypf'),
    ]);
    prisma.reglaAsignacion.findMany.mockResolvedValue([{ moduloId: 'm1' }]);

    const res = await service.recalcular(1);

    // No hay vigente de m1 (es la recontratación): aprobado ⇒ no se re-crea.
    expect(res).toEqual({ creadas: 0, revocadas: 0 });
    expect(prisma.asignacion.createMany).not.toHaveBeenCalled();
  });

  it('modulosAprobados lee por el cliente TRANSACCIONAL, no por this.prisma', async () => {
    // Con el recálculo embebido (ABM de usuarios/reglas) tiene que ver lo mismo que
    // el resto de la transacción. El `tx` de este test es un objeto DISTINTO del
    // prisma inyectado: si el service leyera por this.prisma, este sesion.findMany
    // no se llamaría.
    const tx = {
      ...prisma,
      sesion: {
        findMany: jest.fn().mockResolvedValue([sesionAprobadaDe('m1')]),
      },
    };
    prisma.vinculacionPuestoCentro.findMany.mockResolvedValue([
      par('p-soldador', 'c-ypf'),
    ]);
    prisma.reglaAsignacion.findMany.mockResolvedValue([{ moduloId: 'm1' }]);

    const res = await service.recalcularEnTx(
      tx as unknown as Prisma.TransactionClient,
      1,
    );

    expect(tx.sesion.findMany).toHaveBeenCalled();
    expect(prisma.sesion.findMany).not.toHaveBeenCalled();
    // Y el resultado es el del tx: m1 aprobado ⇒ no se crea.
    expect(res).toEqual({ creadas: 0, revocadas: 0 });
  });

  it('sigue siendo idempotente con un módulo ya aprobado: dos corridas no tocan nada', async () => {
    prisma.sesion.findMany.mockResolvedValue([sesionAprobadaDe('m1')]);
    prisma.vinculacionPuestoCentro.findMany.mockResolvedValue([
      par('p-soldador', 'c-ypf'),
    ]);
    prisma.reglaAsignacion.findMany.mockResolvedValue([{ moduloId: 'm1' }]);
    prisma.asignacion.findMany.mockResolvedValue([
      vigente('a1', 'm1', 'AUTOMATICA'),
    ]);

    expect(await service.recalcular(1)).toEqual({ creadas: 0, revocadas: 0 });
    expect(await service.recalcular(1)).toEqual({ creadas: 0, revocadas: 0 });
    expect(prisma.asignacion.createMany).not.toHaveBeenCalled();
    // Lo que importa del aprobado: NO se revoca la vigente que la regla sigue
    // pidiendo (el paso 6 compara contra `requeridos`, sin restarle los aprobados).
    expect(prisma.asignacion.updateMany).not.toHaveBeenCalled();
  });

  // --- Reglas a NIVEL CENTRO DE COSTO (puestoId null) ---------------------

  it('busca las reglas de centro además de las del par exacto', async () => {
    // Dos pares en el MISMO centro + uno en otro: los centros se deduplican.
    prisma.vinculacionPuestoCentro.findMany.mockResolvedValue([
      par('p-soldador', 'c-taller'),
      par('p-amolador', 'c-taller'),
      par('p-soldador', 'c-ypf'),
    ]);
    prisma.reglaAsignacion.findMany.mockResolvedValue([]);

    await service.recalcular(1);

    expect(prisma.reglaAsignacion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          activo: true,
          deletedAt: null,
          OR: [
            { puestoId: 'p-soldador', centroCostoId: 'c-taller' },
            { puestoId: 'p-amolador', centroCostoId: 'c-taller' },
            { puestoId: 'p-soldador', centroCostoId: 'c-ypf' },
            // La rama de las reglas de centro, con los centros sin repetir.
            { puestoId: null, centroCostoId: { in: ['c-taller', 'c-ypf'] } },
          ],
        },
      }),
    );
  });

  it('una regla ELIMINADA no aporta módulos: queda fuera del matching', async () => {
    // La garantía vive en el where — una regla con deleted_at nunca llega a la
    // unión de requeridos, así que no puede generar una AUTOMATICA.
    prisma.vinculacionPuestoCentro.findMany.mockResolvedValue([
      par('p-soldador', 'c-ypf'),
    ]);
    prisma.reglaAsignacion.findMany.mockResolvedValue([]);

    const res = await service.recalcular(1);

    expect(prisma.reglaAsignacion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ activo: true, deletedAt: null }),
      }),
    );
    expect(res).toEqual({ creadas: 0, revocadas: 0 });
    expect(prisma.asignacion.createMany).not.toHaveBeenCalled();
  });

  it('una regla de centro le aplica a cualquier puesto de ese centro', async () => {
    // Un amolador de Taller: ninguna regla por par lo alcanza, sólo la de centro.
    prisma.vinculacionPuestoCentro.findMany.mockResolvedValue([
      par('p-amolador', 'c-taller'),
    ]);
    prisma.reglaAsignacion.findMany.mockResolvedValue([
      { moduloId: 'm-basico' },
    ]);
    prisma.asignacion.createMany.mockResolvedValue({ count: 1 });

    const res = await service.recalcular(1);

    expect(res).toEqual({ creadas: 1, revocadas: 0 });
    expect(prisma.asignacion.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ moduloId: 'm-basico' })],
    });
  });

  it('el módulo pedido por una regla de centro Y una de par es UNA sola asignación', async () => {
    // Soldador de Taller: le pegan las dos reglas y ambas piden Básico, más la
    // regla de par que pide Soldadura.
    prisma.vinculacionPuestoCentro.findMany.mockResolvedValue([
      par('p-soldador', 'c-taller'),
    ]);
    prisma.reglaAsignacion.findMany.mockResolvedValue([
      { moduloId: 'm-basico' }, // regla de centro (null, Taller, Básico)
      { moduloId: 'm-basico' }, // regla de par (Soldador, Taller, Básico)
      { moduloId: 'm-soldadura' }, // regla de par (Soldador, Taller, Soldadura)
    ]);
    prisma.asignacion.createMany.mockResolvedValue({ count: 2 });

    const res = await service.recalcular(1);

    // Básico entra una sola vez, no dos.
    expect(res).toEqual({ creadas: 2, revocadas: 0 });
    expect(prisma.asignacion.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ moduloId: 'm-basico' }),
        expect.objectContaining({ moduloId: 'm-soldadura' }),
      ],
    });
  });

  it('revoca la AUTOMATICA de una regla de centro al irse el último par de ese centro', async () => {
    // Se le sacó el par de Taller y quedó sólo uno en YPF: Taller sale de la
    // lista de centros y su regla deja de aportar el módulo.
    prisma.vinculacionPuestoCentro.findMany.mockResolvedValue([
      par('p-soldador', 'c-ypf'),
    ]);
    prisma.reglaAsignacion.findMany.mockResolvedValue([]);
    prisma.asignacion.findMany.mockResolvedValue([
      vigente('a1', 'm-basico', 'AUTOMATICA'),
    ]);
    prisma.asignacion.updateMany.mockResolvedValue({ count: 1 });

    const res = await service.recalcular(1);

    expect(res).toEqual({ creadas: 0, revocadas: 1 });
    // c-taller ya no se consulta.
    expect(prisma.reglaAsignacion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { puestoId: null, centroCostoId: { in: ['c-ypf'] } },
          ]),
        }),
      }),
    );
  });

  it('no duplica ni revoca una MANUAL del módulo que pide una regla de centro', async () => {
    prisma.vinculacionPuestoCentro.findMany.mockResolvedValue([
      par('p-amolador', 'c-taller'),
    ]);
    prisma.reglaAsignacion.findMany.mockResolvedValue([
      { moduloId: 'm-basico' },
    ]);
    prisma.asignacion.findMany.mockResolvedValue([
      vigente('a1', 'm-basico', 'MANUAL'),
    ]);

    const res = await service.recalcular(1);

    expect(res).toEqual({ creadas: 0, revocadas: 0 });
    expect(prisma.asignacion.createMany).not.toHaveBeenCalled();
    expect(prisma.asignacion.updateMany).not.toHaveBeenCalled();
  });
});
