import 'dotenv/config';
import { unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { PrismaClient, UploadBizType } from '@prisma/client';

const prisma = new PrismaClient();

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

  const expiredFiles = await prisma.uploadFile.findMany({
    where: {
      bizType: UploadBizType.order_product_image,
      deletedAt: null,
      expiresAt: {
        lte: now,
      },
    },
  });

  let deletedCount = 0;
  let skippedCount = 0;

  for (const file of expiredFiles) {
    let shouldMarkDeleted = false;

    if (file.storageDriver === 'local') {
      const relativePath =
        file.storageKey ||
        (file.fileUrl.startsWith('/uploads/')
          ? file.fileUrl.replace('/uploads/', '')
          : file.fileName);
      const absolutePath = join(process.cwd(), uploadDir, relativePath);

      if (existsSync(absolutePath)) {
        await unlink(absolutePath);
        deletedCount += 1;
        shouldMarkDeleted = true;
      } else {
        skippedCount += 1;
        shouldMarkDeleted = true;
      }
    } else if (file.storageDriver === 'r2' && r2Client && r2Bucket && file.storageKey) {
      await r2Client.send(
        new DeleteObjectCommand({
          Bucket: r2Bucket,
          Key: file.storageKey,
        }),
      );
      deletedCount += 1;
      shouldMarkDeleted = true;
    } else {
      skippedCount += 1;
    }

    if (shouldMarkDeleted) {
      await prisma.uploadFile.update({
        where: { id: file.id },
        data: {
          deletedAt: now,
        },
      });
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
