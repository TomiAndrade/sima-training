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
import { ConfirmarImportPreguntasDto } from './dto/confirmar-import-preguntas.dto';
import { ImportService } from './import.service';

const MAX_FILE_SIZE = 5 * 1024 * 1024;

@Controller('import')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post('usuarios/preview')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE } }),
  )
  previewUsuarios(@UploadedFile() file?: Express.Multer.File) {
    return this.importService.previewUsuarios(file);
  }

  @Post('usuarios/confirm')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE } }),
  )
  confirmarUsuarios(
    @UploadedFile() file: Express.Multer.File,
    @Body('organizacionId') organizacionId?: string,
  ) {
    const orgId =
      organizacionId && organizacionId.trim()
        ? parseInt(organizacionId, 10)
        : undefined;
    return this.importService.confirmarUsuarios(file, orgId);
  }

  @Post('preguntas/preview')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE } }),
  )
  previewPreguntas(@UploadedFile() file?: Express.Multer.File) {
    return this.importService.previewPreguntas(file);
  }

  @Post('preguntas/confirm')
  @UseGuards(JwtAuthGuard)
  confirmarPreguntas(@Body() dto: ConfirmarImportPreguntasDto) {
    return this.importService.confirmarPreguntas(dto);
  }
}
