import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
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
  private readonly logger = new Logger(R2OrderImageStorage.name);
  private readonly client: S3Client | null;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;
  private readonly keyPrefix: string;

  constructor(private readonly configService: ConfigService) {
    const accountId = this.normalizeAccountId(
      this.configService.get<string>('R2_ACCOUNT_ID', ''),
    );
    const accessKeyId = this.cleanConfigValue(
      this.configService.get<string>('R2_ACCESS_KEY_ID', ''),
    );
    const secretAccessKey = this.cleanConfigValue(
      this.configService.get<string>('R2_SECRET_ACCESS_KEY', ''),
    );
    this.bucket = this.cleanConfigValue(
      this.configService.get<string>('R2_BUCKET', ''),
    );
    this.publicBaseUrl = this.cleanConfigValue(
      this.configService.get<string>('UPLOAD_PUBLIC_BASE_URL', ''),
    ).replace(/\/$/, '');
    const configuredPrefix = (
      this.configService.get<string>('R2_BUCKET_PREFIX', 'order-images') ??
      'order-images'
    ).trim();
    this.keyPrefix = (configuredPrefix || 'order-images').replace(
      /^\/+|\/+$/g,
      '',
    );
    const endpoint = accountId
      ? `https://${accountId}.r2.cloudflarestorage.com`
      : '';

    this.client =
      accountId && accessKeyId && secretAccessKey
        ? new S3Client({
            region: 'auto',
            endpoint,
            credentials: {
              accessKeyId,
              secretAccessKey,
            },
          })
        : null;

    if (this.client) {
      this.logger.log(
        `R2 storage configured: endpointHost=${new URL(endpoint).host}, bucket=${this.bucket || '(missing)'}, prefix=${this.keyPrefix}, publicBaseUrl=${this.publicBaseUrl || '(missing)'}`,
      );
    }
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
      fileUrl: `${this.publicBaseUrl}/${storageKey}`,
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

  private cleanConfigValue(value: string | undefined | null) {
    return String(value ?? '')
      .trim()
      .replace(/^['"]|['"]$/g, '')
      .replace(/^[A-Z0-9_]+\s*=\s*/i, '')
      .replace(/^=+/, '')
      .trim();
  }

  private normalizeAccountId(value: string | undefined | null) {
    return this.cleanConfigValue(value)
      .replace(/^https?:\/\//i, '')
      .replace(/\.r2\.cloudflarestorage\.com\/?$/i, '')
      .replace(/^=+/, '')
      .trim();
  }
}
