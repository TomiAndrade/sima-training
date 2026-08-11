import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Diff, hayCambios } from './calcular-diff';

// Escribe filas en AuditLog. El diff en sí lo calcula calcular-diff.ts
// (funciones puras, sin I/O); este service es la única pieza que toca Prisma.
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  // El PRIMER parámetro es el cliente TRANSACCIONAL — sin default a
  // this.prisma y sin marcarlo opcional, a propósito. El log tiene que
  // escribirse en la MISMA transacción que el cambio que audita: si esa
  // transacción se revierte, el log se tiene que revertir con ella. Un
  // default silencioso a this.prisma dejaría un call site escribir el log
  // por fuera de la transacción sin darse cuenta, y ahí quedaría un
  // AuditLog huérfano describiendo un cambio que nunca se aplicó. Hacerlo
  // obligatorio en la firma es lo que impide que eso pase.
  async registrar(
    tx: Prisma.TransactionClient,
    entrada: {
      entidad: string;
      entidadId: string;
      accion: 'CREATE' | 'UPDATE' | 'DELETE';
      diff: Diff;
      actor: string;
    },
  ): Promise<void> {
    // Un UPDATE que no cambió ningún campo no es un evento: no hay nada que
    // reconstruir después, y escribirlo igual sólo ensucia el historial de
    // esa entidad con filas vacías. Mismo criterio para CREATE/DELETE (en la
    // práctica siempre traen al menos un campo, pero la regla es una sola:
    // sin diff, no se escribe).
    if (!hayCambios(entrada.diff)) return;

    await tx.auditLog.create({
      data: {
        entidad: entrada.entidad,
        entidadId: entrada.entidadId,
        accion: entrada.accion,
        diff: entrada.diff as Prisma.InputJsonValue,
        actor: entrada.actor,
      },
    });
  }
}
