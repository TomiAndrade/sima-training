// Los cuatro campos de trazabilidad que ninguna entidad audita como cambio
// propio: createdAt/updatedAt cambian en cada escritura sin decir nada del
// dominio, y createdBy/updatedBy son el string de CANAL que ya viaja aparte
// como `actor` en el AuditLog — auditarlos de nuevo acá sería duplicar el
// mismo dato con otro nombre. Compartido por toda entidad que siga este
// patrón (Vinculacion, Organizacion, y las que se sumen después) para no
// repetir el mismo array de cuatro strings en cada service.
export const CAMPOS_TRAZABILIDAD_IGNORADOS = [
  'createdAt',
  'updatedAt',
  'createdBy',
  'updatedBy',
];
