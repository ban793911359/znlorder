import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UploadBizType } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { JwtUser } from '../../common/interfaces/jwt-user.interface';

@Injectable()
export class UploadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async createImageRecord(file: Express.Multer.File, currentUser: JwtUser) {
    const storageDriver = this.configService.get<string>(
      'UPLOAD_STORAGE_DRIVER',
      'local',
    );
    const retentionDays = Number(
      this.configService.get<string>('UPLOAD_RETENTION_DAYS', '30'),
    );
    const storageKey = `images/${file.filename}`;
    const publicUrl = this.buildPublicUrl(storageKey);
    const expiresAt = new Date(
      Date.now() + retentionDays * 24 * 60 * 60 * 1000,
    );

    const upload = await this.prisma.uploadFile.create({
      data: {
        uploaderId: currentUser.id,
        bizType: UploadBizType.order_product_image,
        storageDriver,
        storageKey,
        originalName: file.originalname,
        fileName: file.filename,
        mimeType: file.mimetype,
        fileSize: file.size,
        fileUrl: publicUrl,
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
        fileUrl: upload.fileUrl,
        expiresAt: upload.expiresAt,
        available: true,
      },
    };
  }

  private buildPublicUrl(storageKey: string) {
    const publicBaseUrl = this.configService.get<string>('UPLOAD_PUBLIC_BASE_URL');
    if (publicBaseUrl) {
      return `${publicBaseUrl.replace(/\/$/, '')}/${storageKey}`;
    }

    return `/uploads/${storageKey}`;
  }
}
