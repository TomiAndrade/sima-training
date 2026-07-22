import { Test, TestingModule } from '@nestjs/testing';
import { RolUsuario, TipoOrganizacion } from '@prisma/client';
import { Workbook } from 'exceljs';
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

describe('ImportService — usuarios', () => {
  let service: ImportService;
  let prisma: {
    organizacion: { findMany: jest.Mock; findUnique: jest.Mock };
    usuario: { findUnique: jest.Mock; findFirst: jest.Mock; create: jest.Mock };
    puesto: { findMany: jest.Mock };
    centroCosto: { findMany: jest.Mock };
    vinculacionPuestoCentro: { deleteMany: jest.Mock };
    $transaction: jest.Mock;
  };

  const YPF = { id: 2, nombre: 'YPF', tipo: TipoOrganizacion.CLIENTE };

  beforeEach(async () => {
    prisma = {
      organizacion: {
        findMany: jest.fn().mockResolvedValue([YPF]),
        findUnique: jest.fn().mockResolvedValue({ tipo: YPF.tipo }),
      },
      usuario: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 1, vinculacion: null }),
      },
      puesto: { findMany: jest.fn() },
      centroCosto: { findMany: jest.fn() },
      vinculacionPuestoCentro: { deleteMany: jest.fn() },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
    };

    // UsuariosService va real, no mockeado: el punto de estos tests es que el
    // import pase por la MISMA validación de la matriz que el alta manual.
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImportService,
        UsuariosService,
        { provide: PrismaService, useValue: prisma },
        { provide: PreguntasService, useValue: {} },
        { provide: ModulosService, useValue: {} },
      ],
    }).compile();

    service = module.get(ImportService);
  });

  it('rechaza un COORDINADOR en una organización CLIENTE (matriz, por el camino del import)', async () => {
    const file = await nomina(
      ['dni', 'nombre', 'apellido', 'empresa', 'rol'],
      [['30111222', 'Ana', 'Paz', 'YPF', 'Coordinador']],
    );

    const result = await service.confirmarUsuarios(file);

    expect(result.created).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.errors[0]).toEqual(
      expect.objectContaining({ dni: '30111222' }),
    );
    expect(result.errors[0].motivo).toContain('COORDINADOR');
    expect(prisma.usuario.create).not.toHaveBeenCalled();
  });

  it('acepta un AUDITOR en esa misma organización CLIENTE', async () => {
    const file = await nomina(
      ['dni', 'nombre', 'apellido', 'empresa', 'rol'],
      [['30111222', 'Ana', 'Paz', 'YPF', 'Auditor']],
    );

    const result = await service.confirmarUsuarios(file);

    expect(result).toEqual({ created: 1, skipped: 0, errors: [] });
    expect(prisma.usuario.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          vinculacion: {
            create: expect.objectContaining({
              organizacionId: 2,
              rol: RolUsuario.AUDITOR,
              createdBy: 'import',
            }),
          },
        }),
      }),
    );
  });

  it('sin columna de rol asume ALUMNO (y por eso lo rechaza en un CLIENTE)', async () => {
    const file = await nomina(
      ['dni', 'nombre', 'apellido', 'empresa'],
      [['30111222', 'Ana', 'Paz', 'YPF']],
    );

    const result = await service.confirmarUsuarios(file);

    expect(result.created).toBe(0);
    expect(result.errors[0].motivo).toContain('ALUMNO');
  });

  it('marca la fila como error si no puede resolver la organización', async () => {
    const file = await nomina(
      ['dni', 'nombre', 'apellido', 'empresa'],
      [['30111222', 'Ana', 'Paz', 'Empresa Fantasma']],
    );

    const result = await service.confirmarUsuarios(file);

    expect(result.created).toBe(0);
    expect(result.errors[0].motivo).toContain('Empresa Fantasma');
  });

  it('crea el usuario cuando la organización interna admite el rol', async () => {
    prisma.organizacion.findMany.mockResolvedValue([
      { id: 1, nombre: 'Ingeniería SIMA' },
    ]);
    prisma.organizacion.findUnique.mockResolvedValue({
      tipo: TipoOrganizacion.INTERNA,
    });

    const file = await nomina(
      ['dni', 'nombre', 'apellido', 'empresa', 'legajo'],
      [['30111222', 'Ana', 'Paz', 'Ingeniería SIMA', 'A-42']],
    );

    const result = await service.confirmarUsuarios(file);

    expect(result.created).toBe(1);
    // El legajo sigue yendo al jsonb de nómina, no al catálogo de puestos.
    expect(prisma.usuario.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ datos: { legajo: 'A-42' } }),
      }),
    );
  });
});
