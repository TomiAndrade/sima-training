import { Test, TestingModule } from '@nestjs/testing';
import { RolUsuario, TipoOrganizacion } from '@prisma/client';
import { Workbook } from 'exceljs';
import { AsignacionesService } from '../asignaciones/asignaciones.service';
import { ModulosService } from '../modulos/modulos.service';
import { PreguntasService } from '../preguntas/preguntas.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsuariosService } from '../usuarios/usuarios.service';
import { ImportService } from './import.service';

// Arma un .xlsx real en memoria (mismo camino que sube el backoffice).
async function nomina(
  headers: string[],
  filas: string[][],
): Promise<Express.Multer.File> {
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet('Nómina');
  sheet.addRow(headers);
  filas.forEach((fila) => sheet.addRow(fila));
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  return { originalname: 'nomina.xlsx', buffer } as Express.Multer.File;
}

// Catálogo de prueba: scores verificados con similitud.ts (ver import.service.spec.ts
// history) — 'Soldadr'/'Talle' son typos por encima de UMBRAL_PARECIDA (0.7),
// 'Amolador'/'Oficina' no se parecen a nada del catálogo.
const PUESTO_SOLDADOR = { id: 'puesto-1', nombre: 'Soldador' };
const CENTRO_TALLER = { id: 'centro-1', nombre: 'Taller' };

describe('ImportService — usuarios', () => {
  let service: ImportService;
  let asignaciones: { recalcularEnTx: jest.Mock };
  let prisma: {
    organizacion: { findUnique: jest.Mock };
    usuario: { findUnique: jest.Mock; findFirst: jest.Mock; create: jest.Mock };
    puesto: { findMany: jest.Mock };
    centroCosto: { findMany: jest.Mock };
    vinculacionPuestoCentro: { deleteMany: jest.Mock };
    $transaction: jest.Mock;
  };

  const YPF_ID = 2; // organización CLIENTE: no admite ALUMNO
  const SIMA_ID = 1; // organización INTERNA: admite ALUMNO

  beforeEach(async () => {
    prisma = {
      organizacion: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ tipo: TipoOrganizacion.INTERNA }),
      },
      usuario: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 1, vinculacion: null }),
      },
      puesto: { findMany: jest.fn().mockResolvedValue([PUESTO_SOLDADOR]) },
      centroCosto: { findMany: jest.fn().mockResolvedValue([CENTRO_TALLER]) },
      vinculacionPuestoCentro: { deleteMany: jest.fn() },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    asignaciones = { recalcularEnTx: jest.fn() };

    // UsuariosService va real, no mockeado: el punto de estos tests es que el
    // import pase por la MISMA validación (matriz, pares, DNI) que el alta manual.
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImportService,
        UsuariosService,
        { provide: PrismaService, useValue: prisma },
        { provide: PreguntasService, useValue: {} },
        { provide: ModulosService, useValue: {} },
        { provide: AsignacionesService, useValue: asignaciones },
      ],
    }).compile();

    service = module.get(ImportService);
  });

  describe('previewUsuarios', () => {
    const headers = ['dni', 'nombre', 'apellido', 'puesto', 'centro de costo'];

    it('clasifica match exacto de puesto y centro de costo como duplicada', async () => {
      const file = await nomina(headers, [
        ['30111222', 'Ana', 'Paz', 'Soldador', 'Taller'],
      ]);

      const preview = await service.previewUsuarios(file);

      expect(preview.filas).toHaveLength(1);
      const fila = preview.filas[0];
      expect(fila.estado).toBe('ok');
      expect(fila.puesto).toEqual({
        texto: 'Soldador',
        estado: 'duplicada',
        similar: { preguntaId: 'puesto-1', texto: 'Soldador', score: 1 },
      });
      expect(fila.centroCosto).toEqual({
        texto: 'Taller',
        estado: 'duplicada',
        similar: { preguntaId: 'centro-1', texto: 'Taller', score: 1 },
      });
    });

    it('detecta un típeo como parecida, con el sugerido y el score', async () => {
      const file = await nomina(headers, [
        ['30111222', 'Ana', 'Paz', 'Soldadr', 'Talle'],
      ]);

      const preview = await service.previewUsuarios(file);

      const fila = preview.filas[0];
      expect(fila.estado).toBe('ok');
      expect(fila.puesto).toEqual({
        texto: 'Soldadr',
        estado: 'parecida',
        similar: { preguntaId: 'puesto-1', texto: 'Soldador', score: 0.71 },
      });
      expect(fila.centroCosto).toEqual({
        texto: 'Talle',
        estado: 'parecida',
        similar: { preguntaId: 'centro-1', texto: 'Taller', score: 0.77 },
      });
    });

    it('marca como nueva cuando no hay nada parecido en el catálogo', async () => {
      const file = await nomina(headers, [
        ['30111222', 'Ana', 'Paz', 'Amolador', 'Oficina'],
      ]);

      const preview = await service.previewUsuarios(file);

      const fila = preview.filas[0];
      expect(fila.puesto).toEqual({ texto: 'Amolador', estado: 'nueva' });
      expect(fila.centroCosto).toEqual({ texto: 'Oficina', estado: 'nueva' });
    });

    it('dos filas con el mismo puesto nuevo clasifican ambas como nueva de forma independiente', async () => {
      const file = await nomina(headers, [
        ['30111222', 'Ana', 'Paz', 'Amolador', 'Taller'],
        ['30222333', 'Bruno', 'Diaz', 'Amolador', 'Taller'],
      ]);

      const preview = await service.previewUsuarios(file);

      expect(preview.filas[0].puesto?.estado).toBe('nueva');
      expect(preview.filas[1].puesto?.estado).toBe('nueva');
    });

    it('marca error si falta el puesto o el centro de costo', async () => {
      const file = await nomina(headers, [
        ['30111222', 'Ana', 'Paz', '', 'Taller'],
      ]);

      const preview = await service.previewUsuarios(file);

      const fila = preview.filas[0];
      expect(fila.estado).toBe('error');
      expect(fila.errores).toContain('Falta el puesto');
      expect(fila.puesto).toBeNull();
    });

    it('marca error si falta el DNI', async () => {
      const file = await nomina(headers, [
        ['', 'Ana', 'Paz', 'Soldador', 'Taller'],
      ]);

      const preview = await service.previewUsuarios(file);

      expect(preview.filas[0].estado).toBe('error');
      expect(preview.filas[0].errores).toContain('Falta el DNI');
    });

    it('marca error si el DNI ya existe activo en la base', async () => {
      prisma.usuario.findUnique.mockResolvedValue({ deletedAt: null });
      const file = await nomina(headers, [
        ['30111222', 'Ana', 'Paz', 'Soldador', 'Taller'],
      ]);

      const preview = await service.previewUsuarios(file);

      expect(preview.filas[0].errores).toContain(
        'DNI duplicado (ya existe un usuario activo)',
      );
    });

    it('marca error en la segunda fila si el DNI se repite dentro del archivo', async () => {
      const file = await nomina(headers, [
        ['30111222', 'Ana', 'Paz', 'Soldador', 'Taller'],
        ['30111222', 'Otro', 'Nombre', 'Soldador', 'Taller'],
      ]);

      const preview = await service.previewUsuarios(file);

      expect(preview.filas[0].estado).toBe('ok');
      expect(preview.filas[1].estado).toBe('error');
      expect(preview.filas[1].errores).toContain('DNI duplicado en el archivo');
    });

    it('legajo va a data; ya no existe un campo de puesto en el jsonb', async () => {
      const file = await nomina(
        [...headers, 'legajo'],
        [['30111222', 'Ana', 'Paz', 'Soldador', 'Taller', 'A-42']],
      );

      const preview = await service.previewUsuarios(file);

      expect(preview.filas[0].data).toEqual({
        dni: '30111222',
        nombre: 'Ana',
        apellido: 'Paz',
        legajo: 'A-42',
      });
    });

    it('avisa si falta la columna puesto o centro de costo en todo el archivo', async () => {
      const file = await nomina(
        ['dni', 'nombre', 'apellido'],
        [['30111222', 'Ana', 'Paz']],
      );

      const preview = await service.previewUsuarios(file);

      expect(preview.warnings).toEqual(
        expect.arrayContaining([
          'No se encontró la columna "puesto"',
          'No se encontró la columna "centro de costo"',
        ]),
      );
    });
  });

  describe('confirmarUsuarios', () => {
    const filaBase = {
      dni: '30111222',
      nombre: 'Ana',
      apellido: 'Paz',
      puestoId: PUESTO_SOLDADOR.id,
      centroCostoId: CENTRO_TALLER.id,
    };

    it('crea el usuario con el par (puesto, centro de costo) ya resuelto', async () => {
      const result = await service.confirmarUsuarios({
        organizacionId: SIMA_ID,
        usuarios: [filaBase],
      });

      expect(result).toEqual({ created: 1, skipped: 0, errors: [] });
      expect(prisma.usuario.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            vinculacion: expect.objectContaining({
              create: expect.objectContaining({
                organizacionId: SIMA_ID,
                rol: RolUsuario.ALUMNO,
                puestosCentros: {
                  create: [
                    {
                      puestoId: PUESTO_SOLDADOR.id,
                      centroCostoId: CENTRO_TALLER.id,
                      principal: true,
                      createdBy: 'import',
                    },
                  ],
                },
              }),
            }),
          }),
        }),
      );
      // Con pares no vacíos, UsuariosService.create toma la rama transaccional
      // que recalcula asignaciones automáticas — sin cambios ahí, solo lo
      // confirmamos acá porque antes el import nunca mandaba pares.
      expect(asignaciones.recalcularEnTx).toHaveBeenCalled();
    });

    it('rechaza ALUMNO en una organización CLIENTE (matriz, por el camino del import)', async () => {
      prisma.organizacion.findUnique.mockResolvedValue({
        tipo: TipoOrganizacion.CLIENTE,
      });

      const result = await service.confirmarUsuarios({
        organizacionId: YPF_ID,
        usuarios: [filaBase],
      });

      expect(result.created).toBe(0);
      expect(result.skipped).toBe(1);
      expect(result.errors[0]).toEqual(
        expect.objectContaining({ dni: '30111222', row: 2 }),
      );
      expect(result.errors[0].motivo).toContain('ALUMNO');
      expect(prisma.usuario.create).not.toHaveBeenCalled();
    });

    it('revalida DNI duplicado activo en base al confirmar (aunque el preview ya lo haya marcado)', async () => {
      prisma.usuario.findFirst.mockImplementation(
        ({ where }: { where: { deletedAt: unknown } }) =>
          Promise.resolve(where.deletedAt === null ? { id: 99 } : null),
      );

      const result = await service.confirmarUsuarios({
        organizacionId: SIMA_ID,
        usuarios: [filaBase],
      });

      expect(result.created).toBe(0);
      expect(result.skipped).toBe(1);
      expect(result.errors[0].motivo).toContain(
        'Ya existe un usuario con el DNI',
      );
      expect(prisma.usuario.create).not.toHaveBeenCalled();
    });

    it('saltea la segunda fila si el DNI se repite dentro del mismo DTO', async () => {
      const result = await service.confirmarUsuarios({
        organizacionId: SIMA_ID,
        usuarios: [
          filaBase,
          { ...filaBase, nombre: 'Otra', apellido: 'Persona' },
        ],
      });

      expect(result.created).toBe(1);
      expect(result.skipped).toBe(1);
      expect(result.errors[0].motivo).toBe('DNI duplicado en el archivo');
      expect(prisma.usuario.create).toHaveBeenCalledTimes(1);
    });

    it('filaIndex se refleja en errors[].row cuando viene', async () => {
      prisma.organizacion.findUnique.mockResolvedValue({
        tipo: TipoOrganizacion.CLIENTE,
      });

      const result = await service.confirmarUsuarios({
        organizacionId: YPF_ID,
        usuarios: [{ ...filaBase, filaIndex: 7 }],
      });

      expect(result.errors[0].row).toBe(7);
    });
  });
});
