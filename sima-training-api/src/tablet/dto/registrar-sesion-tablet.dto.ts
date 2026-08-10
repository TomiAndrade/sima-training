import { OmitType } from '@nestjs/mapped-types';
import { RegistrarSesionDto } from '../../sesiones/dto/registrar-sesion.dto';

// Mismo body que RegistrarSesionDto (el DTO interno de SesionesService) MENOS
// `usuarioId`. Por HTTP el usuarioId NUNCA puede venir del cliente: con un
// token cualquiera podría rendir y aprobar en nombre de otro. El controller
// lo completa con el `sub` del JWT (ver TabletController.rendir()).
//
// Se eligió un DTO propio sin el campo, y no "aceptarlo y pisarlo en
// silencio", porque la ValidationPipe global corre con
// forbidNonWhitelisted: mandar `usuarioId` acá deja de ser un campo ignorado
// y pasa a ser un 400 explícito ("property usuarioId should not exist") —
// mismo mecanismo que ya blinda `aprobada`/`porcentaje` en RegistrarSesionDto.
export class RegistrarSesionTabletDto extends OmitType(RegistrarSesionDto, [
  'usuarioId',
] as const) {}
