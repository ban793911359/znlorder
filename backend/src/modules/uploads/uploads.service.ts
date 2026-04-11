import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { extname } from 'node:path';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../database/prisma/prisma.service';
import { JwtUser } from '../../common/interfaces/jwt-user.interface';
import { LocalOrderImageStorage } from './storage/local.storage';
import { R2OrderImageStorage } from './storage/r2.storage';
import {
  isUploadImageBizType,
  ORDER_PAYMENT_CODE_IMAGE_BIZ_TYPE,
  ORDER_PRODUCT_IMAGE_BIZ_TYPE,
  type UploadImageBizType,
} from './upload-biz-types';

type UploadFileRow = {
  id: number | bigint;
  biz_type: string;
  storage_driver: string;
  storage_key: string | null;
  original_name: string;
  file_name: string;
  mime_type: string;
  file_size: number | bigint;
  file_url: string;
  expires_at: Date;
};

type UploadFileDeleteRow = {
  id: number;
  storage_driver: string;
  storage_key: string | null;
  file_url: string;
  file_name: string;
};

@Injectable()
export class UploadsService {
  private static readonly PAYMENT_IMAGE_EXPIRES_AT = new Date(
    '2099-12-31T23:59:59.999Z',
  );
  private readonly logger = new Logger(UploadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly localOrderImageStorage: LocalOrderImageStorage,
    private readonly r2OrderImageStorage: R2OrderImageStorage,
  ) {}

  async createImageRecord(
    file: Express.Multer.File,
    currentUser: JwtUser,
    bizType?: string,
  ) {
    const normalizedBizType = this.normalizeBizType(bizType);

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
    const expiresAt =
      normalizedBizType === ORDER_PAYMENT_CODE_IMAGE_BIZ_TYPE
        ? UploadsService.PAYMENT_IMAGE_EXPIRES_AT
        : new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);

    const upload = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO upload_files (
          uploader_id,
          biz_type,
          storage_driver,
          storage_key,
          original_name,
          file_name,
          mime_type,
          file_size,
          file_url,
          expires_at,
          created_at
        )
        VALUES (
          ${currentUser.id},
          ${normalizedBizType},
          ${storedFile.storageDriver},
          ${storedFile.storageKey},
          ${file.originalname},
          ${storedFile.fileName},
          ${file.mimetype},
          ${file.size},
          ${storedFile.fileUrl},
          ${expiresAt},
          CURRENT_TIMESTAMP(3)
        )
      `;

      const uploads = await tx.$queryRaw<UploadFileRow[]>`
        SELECT
          id,
          biz_type,
          storage_driver,
          storage_key,
          original_name,
          file_name,
          mime_type,
          file_size,
          file_url,
          expires_at
        FROM upload_files
        WHERE id = LAST_INSERT_ID()
        LIMIT 1
      `;

      return uploads[0];
    });

    return {
      success: true,
      data: {
        id: Number(upload.id),
        fileName: upload.file_name,
        originalName: upload.original_name,
        mimeType: upload.mime_type,
        fileSize: Number(upload.file_size),
        debugVersion: 'upload-debug-v4',
        bizType: upload.biz_type,
        storageDriver: upload.storage_driver,
        storageKey: upload.storage_key,
        fileUrl: this.resolvePublicFileUrl({
          storageDriver: upload.storage_driver,
          storageKey: upload.storage_key,
          fileUrl: upload.file_url,
        }),
        expiresAt: upload.expires_at,
        available: true,
      },
    };
  }

  getStorageForDriver(storageDriver: string) {
    return this.resolveStorage(storageDriver);
  }

  async deleteFilesByIds(fileIds: number[]) {
    if (fileIds.length === 0) {
      return;
    }

    const uniqueIds = [...new Set(fileIds)];
    const files = await this.prisma.$queryRaw<UploadFileDeleteRow[]>(
      Prisma.sql`
        SELECT id, storage_driver, storage_key, file_url, file_name
        FROM upload_files
        WHERE id IN (${Prisma.join(uniqueIds)})
          AND deleted_at IS NULL
      `,
    );

    const deletedAt = new Date();

    for (const file of files) {
      const storageKey = this.resolveStorageKeyForDeletion({
        storageKey: file.storage_key,
        fileUrl: file.file_url,
        fileName: file.file_name,
        storageDriver: file.storage_driver,
      });

      if (!storageKey) {
        this.logger.warn(
          `skip deleting file without storage key: id=${file.id} fileUrl=${file.file_url}`,
        );
        continue;
      }

      try {
        await this.resolveStorage(file.storage_driver).deleteObject(storageKey);
      } catch (error) {
        this.logger.error(
          `failed to delete stored file: id=${file.id} driver=${file.storage_driver} key=${storageKey}`,
          error instanceof Error ? error.stack : undefined,
        );
        throw new InternalServerErrorException('Failed to delete uploaded file');
      }
    }

    if (files.length > 0) {
      await this.prisma.$executeRaw(
        Prisma.sql`
          UPDATE upload_files
          SET deleted_at = ${deletedAt}
          WHERE id IN (${Prisma.join(files.map((file) => file.id))})
        `,
      );
    }
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

  private normalizeBizType(bizType?: string): UploadImageBizType {
    if (!bizType) {
      return ORDER_PRODUCT_IMAGE_BIZ_TYPE;
    }

    if (isUploadImageBizType(bizType)) {
      return bizType;
    }

    throw new BadRequestException(`Unsupported upload biz type: ${bizType}`);
  }

  private resolveStorageKeyForDeletion(file: {
    storageKey: string | null;
    fileUrl: string;
    fileName: string;
    storageDriver: string;
  }) {
    if (file.storageKey) {
      return file.storageKey;
    }

    if (file.storageDriver === 'local' && file.fileUrl.startsWith('/uploads/')) {
      return file.fileUrl.replace('/uploads/', '');
    }

    return null;
  }

  private resolvePublicFileUrl(input: {
    storageDriver: string;
    storageKey: string | null;
    fileUrl: string;
  }) {
    // Prefer the persisted storage key over legacy file URLs so public links stay valid after storage migrations.
    if (input.storageDriver === 'r2' && input.storageKey) {
      const publicBaseUrl = this.configService
        .get<string>('UPLOAD_PUBLIC_BASE_URL', '')
        .trim();
      const prefix = (
        this.configService.get<string>('R2_BUCKET_PREFIX', 'order-images') ??
        'order-images'
      )
        .trim()
        .replace(/^['"]|['"]$/g, '')
        .replace(/^[A-Z0-9_]+\s*=\s*/i, '')
        .replace(/^=+/, '')
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
