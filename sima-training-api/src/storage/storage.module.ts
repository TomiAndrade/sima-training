import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { R2Storage } from './r2.storage';
import { LocalDiskStorage, StorageService } from './storage.service';
import { UploadsController } from './uploads.controller';

// Qué implementación se usa la decide `STORAGE_DRIVER`, no el entorno
// (`NODE_ENV`): son cosas distintas y atarlas impediría lo que más falta hace
// —probar R2 de verdad desde la máquina de desarrollo—, que es la única forma
// de saber que la integración anda antes de deployar.
//
// El default es `local` para que clonar el repo y correr `npm run start:dev`
// siga funcionando sin credenciales de nadie. La contra es que un deploy que se
// olvide de setear la variable arranca en `local` y pierde las imágenes en el
// primer redeploy, en silencio: por eso `render.yaml` la fija explícitamente.
@Module({
  controllers: [UploadsController],
  providers: [
    {
      provide: StorageService,
      inject: [ConfigService],
      useFactory: (config: ConfigService): StorageService => {
        const driver = config.get<string>('STORAGE_DRIVER') ?? 'local';
        switch (driver) {
          case 'r2':
            return new R2Storage(config);
          case 'local':
            return new LocalDiskStorage(config);
          default:
            // Un valor con un typo ("R2", "s3") no puede caer al default
            // silenciosamente: sería exactamente el escenario que esto
            // intenta evitar.
            throw new Error(
              `STORAGE_DRIVER inválido: "${driver}". Valores: local | r2`,
            );
        }
      },
    },
  ],
  exports: [StorageService],
})
export class StorageModule {}
