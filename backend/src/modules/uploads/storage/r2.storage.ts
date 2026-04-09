import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  Injectable,
  InternalServerErrorException,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OrderImageStorage,
  StoredUploadResult,
} from './storage.interface';

@Injectable()
export class R2OrderImageStorage
  implements OrderImageStorage, OnModuleDestroy
{
  private readonly client: S3Client | null;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;
  private readonly keyPrefix: string;

  constructor(private readonly configService: ConfigService) {
    const accountId = this.configService.get<string>('R2_ACCOUNT_ID', '').trim();
    const accessKeyId = this.configService
      .get<string>('R2_ACCESS_KEY_ID', '')
      .trim();
    const secretAccessKey = this.configService
      .get<string>('R2_SECRET_ACCESS_KEY', '')
      .trim();
    this.bucket = this.configService.get<string>('R2_BUCKET', '').trim();
    this.publicBaseUrl = this.configService
      .get<string>('UPLOAD_PUBLIC_BASE_URL', '')
      .trim();
    const configuredPrefix = (
      this.configService.get<string>('R2_BUCKET_PREFIX', 'order-images') ??
      'order-images'
    ).trim();
    this.keyPrefix = (configuredPrefix || 'order-images').replace(
      /^\/+|\/+$/g,
      '',
    );

    this.client =
      accountId && accessKeyId && secretAccessKey
        ? new S3Client({
            region: 'auto',
            endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
            credentials: {
              accessKeyId,
              secretAccessKey,
            },
          })
        : null;
  }

  async saveImage(input: {
    buffer: Buffer;
    fileName: string;
    mimeType: string;
  }): Promise<StoredUploadResult> {
    const storageKey = [this.keyPrefix, 'images', input.fileName]
      .filter(Boolean)
      .join('/');
    const client = this.ensureClient();

    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
        Body: input.buffer,
        ContentType: input.mimeType,
      }),
    );

    return {
      storageDriver: 'r2',
      storageKey,
      fileName: input.fileName,
      fileUrl: `${this.publicBaseUrl.replace(/\/$/, '')}/${storageKey}`,
    };
  }

  async deleteObject(storageKey: string): Promise<void> {
    const client = this.ensureClient();
    await client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
      }),
    );
  }

  async onModuleDestroy() {
    this.client?.destroy();
  }

  private ensureClient() {
    if (!this.client || !this.bucket || !this.publicBaseUrl) {
      throw new InternalServerErrorException(
        'R2 storage is enabled but required R2 environment variables are missing',
      );
    }

    return this.client;
  }
}
