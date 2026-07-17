import { Module } from '@nestjs/common';
import { LocalDiskStorage, StorageService } from './storage.service';

@Module({
  providers: [{ provide: StorageService, useClass: LocalDiskStorage }],
  exports: [StorageService],
})
export class StorageModule {}
