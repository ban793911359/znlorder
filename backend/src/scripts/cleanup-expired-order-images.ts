import 'dotenv/config';
import { unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient, UploadBizType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const uploadDir = process.env.UPLOAD_DIR || 'uploads';
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
      } else {
        skippedCount += 1;
      }
    } else {
      skippedCount += 1;
    }

    await prisma.uploadFile.update({
      where: { id: file.id },
      data: {
        deletedAt: now,
      },
    });
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
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
