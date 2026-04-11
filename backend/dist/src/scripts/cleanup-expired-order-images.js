"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const promises_1 = require("node:fs/promises");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const client_s3_1 = require("@aws-sdk/client-s3");
const client_1 = require("@prisma/client");
const upload_biz_types_1 = require("../modules/uploads/upload-biz-types");
const prisma = new client_1.PrismaClient();
function createR2Client() {
    const accountId = (process.env.R2_ACCOUNT_ID || '').trim();
    const accessKeyId = (process.env.R2_ACCESS_KEY_ID || '').trim();
    const secretAccessKey = (process.env.R2_SECRET_ACCESS_KEY || '').trim();
    if (!accountId || !accessKeyId || !secretAccessKey) {
        return null;
    }
    return new client_s3_1.S3Client({
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
    const expiredFiles = await prisma.$queryRaw(client_1.Prisma.sql `
      SELECT id, storage_driver, storage_key, file_url, file_name
      FROM upload_files
      WHERE biz_type = ${upload_biz_types_1.ORDER_PRODUCT_IMAGE_BIZ_TYPE}
        AND deleted_at IS NULL
        AND expires_at <= ${now}
    `);
    let deletedCount = 0;
    let skippedCount = 0;
    for (const file of expiredFiles) {
        let shouldMarkDeleted = false;
        if (file.storage_driver === 'local') {
            const relativePath = file.storage_key ||
                (file.file_url.startsWith('/uploads/')
                    ? file.file_url.replace('/uploads/', '')
                    : file.file_name);
            const absolutePath = (0, node_path_1.join)(process.cwd(), uploadDir, relativePath);
            if ((0, node_fs_1.existsSync)(absolutePath)) {
                await (0, promises_1.unlink)(absolutePath);
                deletedCount += 1;
                shouldMarkDeleted = true;
            }
            else {
                skippedCount += 1;
                shouldMarkDeleted = true;
            }
        }
        else if (file.storage_driver === 'r2' &&
            r2Client &&
            r2Bucket &&
            file.storage_key) {
            await r2Client.send(new client_s3_1.DeleteObjectCommand({
                Bucket: r2Bucket,
                Key: file.storage_key,
            }));
            deletedCount += 1;
            shouldMarkDeleted = true;
        }
        else {
            skippedCount += 1;
        }
        if (shouldMarkDeleted) {
            await prisma.$executeRaw(client_1.Prisma.sql `
          UPDATE upload_files
          SET deleted_at = ${now}
          WHERE id = ${file.id}
        `);
        }
    }
    console.log(JSON.stringify({
        checked: expiredFiles.length,
        deletedCount,
        skippedCount,
        at: now.toISOString(),
    }, null, 2));
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
