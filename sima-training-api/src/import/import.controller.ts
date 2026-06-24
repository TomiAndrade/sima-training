import {
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ImportService } from './import.service';

// 5 MB — límite razonable para una nómina en Excel.
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
}
