import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UploadBizType } from '@prisma/client';
import { extname } from 'node:path';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../database/prisma/prisma.service';
import { JwtUser } from '../../common/interfaces/jwt-user.interface';
import { LocalOrderImageStorage } from './storage/local.storage';
import { R2OrderImageStorage } from './storage/r2.storage';

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly localOrderImageStorage: LocalOrderImageStorage,
    private readonly r2OrderImageStorage: R2OrderImageStorage,
  ) {}

  async createImageRecord(file: Express.Multer.File, currentUser: JwtUser) {
    const storageDriver = this.configService.get<string>(
      'UPLOAD_STORAGE_DRIVER',
      'local',
    );
    const retentionDays = Number(
      this.configService.get<string>('UPLOAD_RETENTION_DAYS', '30'),
    );
    const fileName = this.buildStoredFileName(file.originalname);
    const storage = this.resolveStorage(storageDriver);
    const storedFile = await storage.saveImage({
      buffer: file.buffer,
      fileName,
      mimeType: file.mimetype,
    });
    this.logger.log(
      `stored image via ${storedFile.storageDriver}: key=${storedFile.storageKey} url=${storedFile.fileUrl}`,
    );
    const expiresAt = new Date(
      Date.now() + retentionDays * 24 * 60 * 60 * 1000,
    );

    const upload = await this.prisma.uploadFile.create({
      data: {
        uploaderId: currentUser.id,
        bizType: UploadBizType.order_product_image,
        storageDriver: storedFile.storageDriver,
        storageKey: storedFile.storageKey,
        originalName: file.originalname,
        fileName: storedFile.fileName,
        mimeType: file.mimetype,
        fileSize: file.size,
        fileUrl: storedFile.fileUrl,
        expiresAt,
      },
    });

    return {
      success: true,
      data: {
        id: upload.id,
        fileName: upload.fileName,
        originalName: upload.originalName,
        mimeType: upload.mimeType,
        fileSize: upload.fileSize,
        storageDriver: upload.storageDriver,
        storageKey: upload.storageKey,
        fileUrl: this.resolvePublicFileUrl({
          storageDriver: upload.storageDriver,
          storageKey: upload.storageKey,
          fileUrl: upload.fileUrl,
        }),
        expiresAt: upload.expiresAt,
        available: true,
      },
    };
  }

  getStorageForDriver(storageDriver: string) {
    return this.resolveStorage(storageDriver);
  }

  private resolveStorage(storageDriver: string) {
    if (storageDriver === 'r2') {
      return this.r2OrderImageStorage;
    }

    if (storageDriver === 'local') {
      return this.localOrderImageStorage;
    }

    throw new InternalServerErrorException(
      `Unsupported upload storage driver: ${storageDriver}`,
    );
  }

  private buildStoredFileName(originalName: string) {
    const suffix = `${Date.now()}-${randomBytes(6).toString('hex')}`;
    return `${suffix}${extname(originalName)}`;
  }

  private resolvePublicFileUrl(input: {
    storageDriver: string;
    storageKey: string | null;
    fileUrl: string;
  }) {
    if (input.storageDriver === 'r2' && input.storageKey) {
      const publicBaseUrl = this.configService
        .get<string>('UPLOAD_PUBLIC_BASE_URL', '')
        .trim();
      const prefix = (
        this.configService.get<string>('R2_BUCKET_PREFIX', 'order-images') ??
        'order-images'
      )
        .trim()
        .replace(/^\/+|\/+$/g, '') || 'order-images';
      const normalizedStorageKey = input.storageKey.startsWith(`${prefix}/`)
        ? input.storageKey
        : `${prefix}/${input.storageKey.replace(/^\/+/, '')}`;

      if (publicBaseUrl) {
        return `${publicBaseUrl.replace(/\/$/, '')}/${normalizedStorageKey}`;
      }
    }

    return input.fileUrl;
  }
}
