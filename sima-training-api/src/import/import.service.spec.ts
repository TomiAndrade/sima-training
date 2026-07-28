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

describe('ImportService — usuarios', () => {
  let service: ImportService;
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
        findUnique: jest.fn().mockResolvedValue({ tipo: TipoOrganizacion.CLIENTE }),
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
        // El import crea usuarios sin pares → recalcularEnTx no llega a
        // invocarse, pero UsuariosService lo necesita para resolver el DI.
        { provide: AsignacionesService, useValue: { recalcularEnTx: jest.fn() } },
      ],
    }).compile();

    service = module.get(ImportService);
  });

  it('rechaza el import completo si no se indica organización', async () => {
    const file = await nomina(
      ['dni', 'nombre', 'apellido'],
      [['30111222', 'Ana', 'Paz']],
    );

    await expect(service.confirmarUsuarios(file, undefined)).rejects.toThrow(
      'Debe indicar la organización',
    );
    expect(prisma.usuario.create).not.toHaveBeenCalled();
  });

  it('todo usuario importado entra como ALUMNO — rechazado en una organización CLIENTE', async () => {
    const file = await nomina(
      ['dni', 'nombre', 'apellido'],
      [['30111222', 'Ana', 'Paz']],
    );

    const result = await service.confirmarUsuarios(file, YPF_ID);

    expect(result.created).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.errors[0]).toEqual(
      expect.objectContaining({ dni: '30111222' }),
    );
    expect(result.errors[0].motivo).toContain('ALUMNO');
    expect(prisma.usuario.create).not.toHaveBeenCalled();
  });

  it('ignora una eventual columna "rol" del Excel: siempre crea con ALUMNO', async () => {
    prisma.organizacion.findUnique.mockResolvedValue({
      tipo: TipoOrganizacion.INTERNA,
    });

    const file = await nomina(
      ['dni', 'nombre', 'apellido', 'rol'],
      [['30111222', 'Ana', 'Paz', 'Coordinador']],
    );

    const result = await service.confirmarUsuarios(file, SIMA_ID);

    expect(result).toEqual({ created: 1, skipped: 0, errors: [] });
    expect(prisma.usuario.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          vinculacion: {
            create: expect.objectContaining({
              organizacionId: SIMA_ID,
              rol: RolUsuario.ALUMNO,
              createdBy: 'import',
            }),
          },
        }),
      }),
    );
  });

  it('crea el usuario cuando la organización interna admite ALUMNO', async () => {
    prisma.organizacion.findUnique.mockResolvedValue({
      tipo: TipoOrganizacion.INTERNA,
    });

    const file = await nomina(
      ['dni', 'nombre', 'apellido', 'legajo'],
      [['30111222', 'Ana', 'Paz', 'A-42']],
    );

    const result = await service.confirmarUsuarios(file, SIMA_ID);

    expect(result.created).toBe(1);
    // El legajo sigue yendo al jsonb de nómina, no al catálogo de puestos.
    expect(prisma.usuario.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ datos: { legajo: 'A-42' } }),
      }),
    );
  });
});
