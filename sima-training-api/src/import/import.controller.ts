import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GESTION_NOMINA, SOLO_ADMINISTRADOR } from '../auth/matriz-permisos';
import { Roles } from '../auth/roles.decorator';
import { ConfirmarImportPreguntasDto } from './dto/confirmar-import-preguntas.dto';
import { ConfirmarImportUsuariosDto } from './dto/confirmar-import-usuarios.dto';
import { ImportService } from './import.service';

const MAX_FILE_SIZE = 5 * 1024 * 1024;

@Controller('import')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post('usuarios/preview')
  @UseGuards(JwtAuthGuard)
  @Roles(...GESTION_NOMINA)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE } }),
  )
  previewUsuarios(@UploadedFile() file?: Express.Multer.File) {
    return this.importService.previewUsuarios(file);
  }

  @Post('usuarios/confirm')
  @UseGuards(JwtAuthGuard)
  @Roles(...GESTION_NOMINA)
  confirmarUsuarios(@Body() dto: ConfirmarImportUsuariosDto) {
    return this.importService.confirmarUsuarios(dto);
  }

  @Post('preguntas/preview')
  @UseGuards(JwtAuthGuard)
  @Roles(...SOLO_ADMINISTRADOR)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE } }),
  )
  previewPreguntas(@UploadedFile() file?: Express.Multer.File) {
    return this.importService.previewPreguntas(file);
  }

  @Post('preguntas/confirm')
  @UseGuards(JwtAuthGuard)
  @Roles(...SOLO_ADMINISTRADOR)
  confirmarPreguntas(@Body() dto: ConfirmarImportPreguntasDto) {
    return this.importService.confirmarPreguntas(dto);
  }
}
