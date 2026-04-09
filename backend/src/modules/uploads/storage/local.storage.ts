import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  OrderImageStorage,
  StoredUploadResult,
} from './storage.interface';

@Injectable()
export class LocalOrderImageStorage implements OrderImageStorage {
  constructor(private readonly configService: ConfigService) {}

  async saveImage(input: {
    buffer: Buffer;
    fileName: string;
    mimeType: string;
  }): Promise<StoredUploadResult> {
    const uploadDir = this.configService.get<string>('UPLOAD_DIR', 'uploads');
    const storageKey = `images/${input.fileName}`;
    const absolutePath = join(process.cwd(), uploadDir, storageKey);

    await mkdir(join(process.cwd(), uploadDir, 'images'), { recursive: true });
    await writeFile(absolutePath, input.buffer);

    return {
      storageDriver: 'local',
      storageKey,
      fileName: input.fileName,
      fileUrl: this.buildPublicUrl(storageKey),
    };
  }

  async deleteObject(storageKey: string): Promise<void> {
    const uploadDir = this.configService.get<string>('UPLOAD_DIR', 'uploads');
    const absolutePath = join(process.cwd(), uploadDir, storageKey);

    if (existsSync(absolutePath)) {
      await unlink(absolutePath);
    }
  }

  private buildPublicUrl(storageKey: string) {
    const publicBaseUrl = this.configService.get<string>('UPLOAD_PUBLIC_BASE_URL');
    if (publicBaseUrl) {
      return `${publicBaseUrl.replace(/\/$/, '')}/${storageKey}`;
    }

    return `/uploads/${storageKey}`;
  }
}
