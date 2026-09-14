-- Extiende AuditLog con la identidad REAL del actor, ahora que @Actor()/RolesGuard
-- ya están disponibles para leerla (antes de esto, todo se auditaba como el
-- string de canal 'backoffice'/'import', nunca quién lo hizo de verdad).
--
-- Decisiones que el SQL no cuenta solo:
--
--   * `actor` (TEXT, ya existía) NO se toca. Sigue siendo el string de CANAL
--     ('backoffice', 'import', 'tablet') y no cambia de significado: las filas
--     viejas y las nuevas siguen diciendo lo mismo ahí. La identidad real va en
--     las cuatro columnas nuevas, aparte.
--
--   * Las cuatro son NULLABLE y esta migración NO hace backfill. Las filas
--     existentes quedan con 'actor' en su string de canal de siempre y estas
--     cuatro en NULL — no hay valor real que rellenar ahí sin inventarlo (no
--     hay forma de reconstruir qué usuario hizo cada cambio viejo).
--
--   * `actor_usuario_id` es INTEGER simple, SIN foreign key a `usuarios`. Es la
--     misma razón por la que `entidad_id` no es FK a ninguna tabla (ver
--     20260811134808_audit_log): esta tabla es polimórfica e INMUTABLE, y
--     atarla con una FK normal acoplaría un hecho histórico a que la fila del
--     actor nunca se borre. El filtro del log global por actor va por esta
--     columna y por `actor_rol`, nunca por join.
--
--   * `actor_nombre`/`actor_apellido` son sólo para MOSTRAR, congelados al
--     momento del cambio — igual que el resto del diff no se actualiza
--     retroactivamente, si la persona cambia de nombre después la fila vieja
--     sigue diciendo el nombre de entonces.
--
--   * `actor_rol` reusa el enum `RolUsuario` que ya existe (no uno propio):
--     es el mismo rol que ya vive en Vinculacion, no hace falta uno nuevo.
--
--   * Los dos índices nuevos son btree simples, sin WHERE: NULL no rompe nada,
--     sólo no matchea ningún filtro por actor (coherente con que las filas
--     viejas no tienen actor real). Son los dos ejes de filtro del log global
--     (AuditService.listarGlobal), junto con el `created_at` que ya existía.

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "actor_apellido" TEXT,
ADD COLUMN     "actor_nombre" TEXT,
ADD COLUMN     "actor_rol" "RolUsuario",
ADD COLUMN     "actor_usuario_id" INTEGER;

-- CreateIndex
CREATE INDEX "audit_logs_actor_usuario_id_idx" ON "audit_logs"("actor_usuario_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_rol_idx" ON "audit_logs"("actor_rol");
