import 'dotenv/config';
import { unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Prisma, PrismaClient } from '@prisma/client';
import { ORDER_PRODUCT_IMAGE_BIZ_TYPE } from '../modules/uploads/upload-biz-types';

const prisma = new PrismaClient();

type ExpiredUploadFileRow = {
  id: number;
  storage_driver: string;
  storage_key: string | null;
  file_url: string;
  file_name: string;
};

function createR2Client() {
  const accountId = (process.env.R2_ACCOUNT_ID || '').trim();
  const accessKeyId = (process.env.R2_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = (process.env.R2_SECRET_ACCESS_KEY || '').trim();

  if (!accountId || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

async function main() {
  const uploadDir = process.env.UPLOAD_DIR || 'uploads';
  const r2Bucket = (process.env.R2_BUCKET || '').trim();
  const r2Client = createR2Client();
  const now = new Date();

  const expiredFiles = await prisma.$queryRaw<ExpiredUploadFileRow[]>(
    Prisma.sql`
      SELECT id, storage_driver, storage_key, file_url, file_name
      FROM upload_files
      WHERE biz_type = ${ORDER_PRODUCT_IMAGE_BIZ_TYPE}
        AND deleted_at IS NULL
        AND expires_at <= ${now}
    `,
  );

  let deletedCount = 0;
  let skippedCount = 0;

  for (const file of expiredFiles) {
    let shouldMarkDeleted = false;

    if (file.storage_driver === 'local') {
      const relativePath =
        file.storage_key ||
        (file.file_url.startsWith('/uploads/')
          ? file.file_url.replace('/uploads/', '')
          : file.file_name);
      const absolutePath = join(process.cwd(), uploadDir, relativePath);

      if (existsSync(absolutePath)) {
        await unlink(absolutePath);
        deletedCount += 1;
        shouldMarkDeleted = true;
      } else {
        skippedCount += 1;
        shouldMarkDeleted = true;
      }
    } else if (
      file.storage_driver === 'r2' &&
      r2Client &&
      r2Bucket &&
      file.storage_key
    ) {
      await r2Client.send(
        new DeleteObjectCommand({
          Bucket: r2Bucket,
          Key: file.storage_key,
        }),
      );
      deletedCount += 1;
      shouldMarkDeleted = true;
    } else {
      skippedCount += 1;
    }

    if (shouldMarkDeleted) {
      await prisma.$executeRaw(
        Prisma.sql`
          UPDATE upload_files
          SET deleted_at = ${now}
          WHERE id = ${file.id}
        `,
      );
    }
  }

  console.log(
    JSON.stringify(
      {
        checked: expiredFiles.length,
        deletedCount,
        skippedCount,
        at: now.toISOString(),
      },
      null,
      2,
    ),
  );

  r2Client?.destroy();
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
