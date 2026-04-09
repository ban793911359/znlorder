import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtUser } from '../../common/interfaces/jwt-user.interface';
import { UploadsService } from './uploads.service';

const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

@Controller('uploads')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UploadsController {
  constructor(
    private readonly uploadsService: UploadsService,
    private readonly configService: ConfigService,
  ) {}

  @Post('images')
  @Roles(UserRole.operator)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      fileFilter: (_request, file, callback) => {
        if (!allowedMimeTypes.includes(file.mimetype)) {
          callback(
            new BadRequestException('Only jpg, png and webp images are allowed'),
            false,
          );
          return;
        }

        callback(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  async uploadImage(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() currentUser: JwtUser,
  ) {
    const maxUploadSizeMb = Number(
      this.configService.get<string>('MAX_UPLOAD_SIZE_MB', '5'),
    );

    if (!file) {
      throw new BadRequestException('Image file is required');
    }

    if (file.size > maxUploadSizeMb * 1024 * 1024) {
      throw new BadRequestException(
        `File exceeds ${maxUploadSizeMb}MB upload limit`,
      );
    }

    return this.uploadsService.createImageRecord(file, currentUser);
  }
}
