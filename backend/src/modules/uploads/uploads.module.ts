import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';
import { LocalOrderImageStorage } from './storage/local.storage';
import { R2OrderImageStorage } from './storage/r2.storage';

@Module({
  imports: [ConfigModule],
  controllers: [UploadsController],
  providers: [UploadsService, LocalOrderImageStorage, R2OrderImageStorage],
  exports: [UploadsService],
})
export class UploadsModule {}
