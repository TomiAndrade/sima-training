import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

// Body de PATCH /reglas-asignacion/:id — edición parcial. Los dos campos son
// opcionales pero tiene que venir al menos uno (lo valida el service):
//   - moduloId: corrige a qué módulo obliga la regla. El alcance (puesto +
//     centro) NO se edita: es dónde vive la regla en el listado, moverla de
//     lugar es eliminarla y crear otra.
//   - activo: baja lógica. false deja de generar obligaciones (recalcular() ya
//     no la considera), true la reactiva. Para sacarla del listado hay DELETE.
export class UpdateReglaAsignacionDto {
  @IsOptional()
  @IsUUID()
  moduloId?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
