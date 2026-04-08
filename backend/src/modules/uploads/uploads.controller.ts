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
import { diskStorage } from 'multer';
import { randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';
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
      storage: diskStorage({
        destination: (_request, _file, callback) => {
          const uploadDir = process.env.UPLOAD_DIR || 'uploads';
          const destination = join(process.cwd(), uploadDir, 'images');
          mkdirSync(destination, { recursive: true });
          callback(null, destination);
        },
        filename: (_request, file, callback) => {
          const suffix = `${Date.now()}-${randomBytes(6).toString('hex')}`;
          callback(null, `${suffix}${extname(file.originalname)}`);
        },
      }),
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
