import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Organizacion, Prisma } from '@prisma/client';
import { ActorIdentidad } from '../audit/actor-de-identidad';
import { AuditService } from '../audit/audit.service';
import { calcularDiff, hayCambios } from '../audit/calcular-diff';
import { CAMPOS_TRAZABILIDAD_IGNORADOS } from '../audit/campos-trazabilidad';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrganizacionDto } from './dto/create-organizacion.dto';
import { UpdateOrganizacionDto } from './dto/update-organizacion.dto';

// Arma un objeto NUEVO picking sólo los campos escalares — mismo criterio que
// vinculacionEscalar en usuarios.service.ts: nunca un spread de la fila
// entera, para no arrastrar nada que no sea parte de lo que se audita.
function organizacionEscalar(o: Organizacion): Record<string, unknown> {
  return {
    id: o.id,
    nombre: o.nombre,
    tipo: o.tipo,
    organizacionPadreId: o.organizacionPadreId,
    activa: o.activa,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    createdBy: o.createdBy,
    updatedBy: o.updatedBy,
  };
}

@Injectable()
export class OrganizacionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // `createdBy`/`updatedBy` no se estaban seteando hasta ahora — quedaban
  // NULL pese a que la columna existe desde el principio (ver
  // docs/decisiones/auditoria.md). 'backoffice' es el único canal que hoy
  // crea organizaciones (a diferencia de Usuario, no hay import de Excel que
  // las toque), así que va fijo, igual que `remove()` en UsuariosService.
  async create(dto: CreateOrganizacionDto, actorIdentidad?: ActorIdentidad) {
    await this.assertPadreExiste(dto.organizacionPadreId);

    return this.prisma.$transaction(async (tx) => {
      const creada = await tx.organizacion.create({
        data: { ...dto, createdBy: 'backoffice' },
      });
      await this.auditarOrganizacion(tx, 'CREATE', null, creada, actorIdentidad);
      return creada;
    });
  }

  findAll() {
    return this.prisma.organizacion.findMany({ orderBy: { id: 'asc' } });
  }

  async findOne(id: number) {
    const org = await this.prisma.organizacion.findUnique({ where: { id } });
    if (!org) {
      throw new NotFoundException(`Organización ${id} no encontrada`);
    }
    return org;
  }

  async update(
    id: number,
    dto: UpdateOrganizacionDto,
    actorIdentidad?: ActorIdentidad,
  ) {
    if (dto.organizacionPadreId !== undefined) {
      if (dto.organizacionPadreId === id) {
        throw new BadRequestException(
          'Una organización no puede ser su propia organización padre',
        );
      }
      await this.assertPadreExiste(dto.organizacionPadreId);
    }

    return this.prisma.$transaction(async (tx) => {
      // El "antes" se lee DENTRO de la transacción y recién ahí se valida la
      // existencia — mismo criterio que UsuariosService.update() con
      // Vinculacion: si se leyera afuera, entre esa lectura y el commit
      // podría haber pasado otra escritura, y el diff de auditoría tiene que
      // reflejar el estado inmediatamente anterior a ESTE cambio, no uno
      // potencialmente viejo.
      const antes = await tx.organizacion.findUnique({ where: { id } });
      if (!antes) {
        throw new NotFoundException(`Organización ${id} no encontrada`);
      }

      const actualizada = await tx.organizacion.update({
        where: { id },
        data: { ...dto, updatedBy: 'backoffice' },
      });
      await this.auditarOrganizacion(
        tx,
        'UPDATE',
        antes,
        actualizada,
        actorIdentidad,
      );
      return actualizada;
    });
  }

  // Si el diff da vacío, no llama a registrar() — el chequeo se hace ACÁ y no
  // se delega en AuditService: mismo criterio que auditarVinculacion en
  // UsuariosService, para que se pueda testear con AuditService mockeado (un
  // mock no reproduce el "no escribe si el diff está vacío" del service real).
  private async auditarOrganizacion(
    tx: Prisma.TransactionClient,
    accion: 'CREATE' | 'UPDATE',
    antes: Organizacion | null,
    despues: Organizacion | null,
    actorIdentidad?: ActorIdentidad,
  ) {
    const referencia = antes ?? despues;
    if (!referencia) return;

    const diff = calcularDiff(
      antes ? organizacionEscalar(antes) : null,
      despues ? organizacionEscalar(despues) : null,
      CAMPOS_TRAZABILIDAD_IGNORADOS,
    );
    if (!hayCambios(diff)) return;

    await this.audit.registrar(tx, {
      entidad: 'Organizacion',
      entidadId: String(referencia.id),
      accion,
      diff,
      actor: 'backoffice',
      ...actorIdentidad,
    });
  }

  private async assertPadreExiste(padreId?: number | null) {
    if (padreId === undefined || padreId === null) return;
    const padre = await this.prisma.organizacion.findUnique({
      where: { id: padreId },
    });
    if (!padre) {
      throw new BadRequestException(
        `La organización padre ${padreId} no existe`,
      );
    }
  }
}
